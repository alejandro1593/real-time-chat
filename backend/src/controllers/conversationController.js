const { Op } = require('sequelize');
const { sequelize, User, Conversation, Message, ConversationParticipant } = require('../models');

function safeUser(user) {
  return user.toSafe ? user.toSafe() : user;
}

async function list(req, res, next) {
  try {
    const conversations = await req.user.getConversations({
      include: [
        {
          model: Message,
          as: 'messages',
          limit: 1,
          order: [['createdAt', 'DESC']],
          include: [{ model: User, as: 'sender', attributes: { exclude: ['passwordHash'] } }]
        },
        { model: User, as: 'participants', attributes: { exclude: ['passwordHash'] } }
      ]
    });

    const ids = conversations.map((c) => c.id);
    const allMsgs = ids.length
      ? await Message.findAll({
          where: { conversationId: { [Op.in]: ids }, deleted: false, userId: { [Op.ne]: req.user.id } },
          attributes: ['conversationId', 'readBy']
        })
      : [];
    const unreadMap = {};
    allMsgs.forEach((m) => {
      const r = Array.isArray(m.readBy) ? m.readBy : [];
      if (!r.includes(req.user.id)) {
        unreadMap[m.conversationId] = (unreadMap[m.conversationId] || 0) + 1;
      }
    });

    const result = conversations
      .map((c) => ({
        id: c.id,
        type: c.type,
        name: c.name,
        ownerId: c.ownerId,
        createdAt: c.createdAt,
        lastMessage: c.messages[0] || null,
        participants: c.participants.map(safeUser),
        unreadCount: unreadMap[c.id] || 0
      }))
      .sort((a, b) => (b.lastMessage ? b.lastMessage.createdAt : 0) - (a.lastMessage ? a.lastMessage.createdAt : 0));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getOrCreateDirect(req, res, next) {
  try {
    const otherUserId = req.body.userId;
    if (!otherUserId || otherUserId === req.user.id) {
      return res.status(400).json({ message: 'Usuario inválido' });
    }
    const other = await User.findByPk(otherUserId);
    if (!other) return res.status(404).json({ message: 'Usuario no encontrado' });

    const mine = await req.user.getConversations({
      where: { type: 'direct' },
      include: [{ model: User, as: 'participants', attributes: ['id'] }]
    });
    const existing = mine.find((c) =>
      c.participants.some((p) => p.id === otherUserId)
    );
    if (existing) return res.json(existing);

    const conversation = await sequelize.transaction(async (t) => {
      const conv = await Conversation.create({ type: 'direct' }, { transaction: t });
      await ConversationParticipant.bulkCreate(
        [
          { conversationId: conv.id, userId: req.user.id },
          { conversationId: conv.id, userId: otherUserId }
        ],
        { transaction: t }
      );
      return conv;
    });

    const full = await Conversation.findByPk(conversation.id, {
      include: [{ model: User, as: 'participants', attributes: { exclude: ['passwordHash'] } }]
    });
    res.status(201).json(full);
  } catch (err) {
    next(err);
  }
}

async function buildReplySnapshot(conversationId, replyToId, currentUserId) {
  if (!replyToId) return null;
  const original = await Message.findOne({
    where: { id: replyToId, conversationId },
    include: [{ model: User, as: 'sender', attributes: ['username'] }]
  });
  if (!original || original.deleted) return null;
  return {
    id: original.id,
    content: original.content || '',
    image: original.image || null,
    file: original.file || null,
    sender: original.userId === currentUserId ? 'tú' : (original.sender?.username || null)
  };
}

async function createGroup(req, res, next) {
  try {
    const { name, userIds } = req.body;
    if (!name) return res.status(400).json({ message: 'El nombre del grupo es obligatorio' });
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'Debes añadir al menos un miembro' });
    }
    const memberIds = [...new Set([req.user.id, ...userIds])];

    const conversation = await sequelize.transaction(async (t) => {
      const conv = await Conversation.create({ type: 'group', name, ownerId: req.user.id }, { transaction: t });
      await ConversationParticipant.bulkCreate(
        memberIds.map((userId) => ({ conversationId: conv.id, userId })),
        { transaction: t }
      );
      return conv;
    });

    const full = await Conversation.findByPk(conversation.id, {
      include: [{ model: User, as: 'participants', attributes: { exclude: ['passwordHash'] } }]
    });
    res.status(201).json(full);
  } catch (err) {
    next(err);
  }
}

async function getMessages(req, res, next) {
  try {
    const conversationId = req.params.id;
    const isMember = await ConversationParticipant.findOne({
      where: { conversationId, userId: req.user.id }
    });
    if (!isMember) return res.status(403).json({ message: 'No eres miembro de esta conversación' });

    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const before = req.query.before;

    const where = { conversationId, deleted: false };
    if (before) {
      const cursor = await Message.findByPk(before);
      if (cursor) where.createdAt = { [Op.lt]: cursor.createdAt };
    }

    const messages = await Message.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      include: [{ model: User, as: 'sender', attributes: { exclude: ['passwordHash'] } }]
    });
    res.json(messages.reverse().map((m) => ({ ...m.toJSON(), sender: safeUser(m.sender) })));
  } catch (err) {
    next(err);
  }
}

async function sendMessage(req, res, next) {
  try {
    const conversationId = req.params.id;
    const { content, image, file, replyToId } = req.body;
    const hasMedia = image || (Array.isArray(file) ? file.length > 0 : file);
    if ((!content || !content.trim()) && !hasMedia) {
      return res.status(400).json({ message: 'El mensaje no puede estar vacío' });
    }
    const isMember = await ConversationParticipant.findOne({
      where: { conversationId, userId: req.user.id }
    });
    if (!isMember) return res.status(403).json({ message: 'No eres miembro de esta conversación' });

    const replyTo = await buildReplySnapshot(conversationId, replyToId, req.user.id);

    const message = await Message.create({
      conversationId,
      userId: req.user.id,
      content: (content || '').trim(),
      image: image || null,
      file: file || null,
      replyTo,
      reactions: {},
      readBy: []
    });

    const result = {
      id: message.id,
      conversationId,
      content: message.content,
      image: message.image,
      file: message.file,
      replyTo: message.replyTo,
      reactions: message.reactions,
      edited: message.edited,
      deleted: message.deleted,
      readBy: message.readBy,
      createdAt: message.createdAt,
      sender: safeUser(req.user)
    };

    const conversation = await Conversation.findByPk(conversationId, {
      include: [{ model: User, as: 'participants', attributes: ['id'] }]
    });
    const io = req.app.get('io');
    if (io) {
      for (const p of conversation.participants) {
        io.to(`user:${p.id}`).emit('message:new', result);
      }
    }
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function toggleReaction(req, res, next) {
  try {
    const { id, msgId } = req.params;
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ message: 'Emoji obligatorio' });
    const isMember = await ConversationParticipant.findOne({ where: { conversationId: id, userId: req.user.id } });
    if (!isMember) return res.status(403).json({ message: 'No eres miembro' });
    const msg = await Message.findByPk(msgId);
    if (!msg || msg.deleted) return res.status(404).json({ message: 'Mensaje no encontrado' });

    const reactions = { ...(msg.reactions || {}) };
    const users = [...(Array.isArray(reactions[emoji]) ? reactions[emoji] : [])];
    const idx = users.indexOf(req.user.id);
    if (idx >= 0) {
      users.splice(idx, 1);
    } else {
      users.push(req.user.id);
    }
    if (users.length === 0) delete reactions[emoji];
    else reactions[emoji] = users;
    await msg.update({ reactions });

    const result = { ...msg.toJSON(), sender: safeUser(await msg.getSender()) };
    const io = req.app.get('io');
    if (io) {
      const conv = await Conversation.findByPk(id, { include: [{ model: User, as: 'participants', attributes: ['id'] }] });
      for (const p of conv.participants) {
        io.to(`user:${p.id}`).emit('message:update', result);
      }
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function renameGroup(req, res, next) {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Nombre obligatorio' });
    const conv = await Conversation.findByPk(id);
    if (!conv || conv.type !== 'group') return res.status(400).json({ message: 'No es un grupo' });
    if (conv.ownerId !== req.user.id) return res.status(403).json({ message: 'Solo el creador puede renombrar el grupo' });
    await conv.update({ name: name.trim().slice(0, 80) });
    const io = req.app.get('io');
    if (io) {
      const updated = await Conversation.findByPk(id, { include: [{ model: User, as: 'participants', attributes: { exclude: ['passwordHash'] } }] });
      for (const p of updated.participants) {
        io.to(`user:${p.id}`).emit('conversation:update', updated.toJSON());
      }
    }
    res.json(conv);
  } catch (err) {
    next(err);
  }
}

async function deleteGroup(req, res, next) {
  try {
    const { id } = req.params;
    const conv = await Conversation.findByPk(id);
    if (!conv || conv.type !== 'group') return res.status(400).json({ message: 'No es un grupo' });
    if (conv.ownerId !== req.user.id) return res.status(403).json({ message: 'Solo el creador puede eliminar el grupo' });
    const participants = await conv.getParticipants({ attributes: ['id'] });
    await sequelize.transaction(async (t) => {
      await Message.destroy({ where: { conversationId: id }, transaction: t });
      await ConversationParticipant.destroy({ where: { conversationId: id }, transaction: t });
      await conv.destroy({ transaction: t });
    });
    const io = req.app.get('io');
    if (io) {
      for (const p of participants) {
        io.to(`user:${p.id}`).emit('conversation:removed', { conversationId: id });
      }
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function editMessage(req, res, next) {
  try {
    const { msgId } = req.params;
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ message: 'Contenido obligatorio' });
    const msg = await Message.findByPk(msgId);
    if (!msg) return res.status(404).json({ message: 'Mensaje no encontrado' });
    if (msg.userId !== req.user.id) return res.status(403).json({ message: 'Solo puedes editar tus mensajes' });
    await msg.update({ content: content.trim(), edited: true });
    const result = { ...msg.toJSON(), sender: safeUser(req.user) };
    const io = req.app.get('io');
    if (io) {
      const conv = await Conversation.findByPk(msg.conversationId, { include: [{ model: User, as: 'participants', attributes: ['id'] }] });
      for (const p of conv.participants) {
        io.to(`user:${p.id}`).emit('message:update', result);
      }
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function deleteMessage(req, res, next) {
  try {
    const { msgId } = req.params;
    const msg = await Message.findByPk(msgId);
    if (!msg) return res.status(404).json({ message: 'Mensaje no encontrado' });
    if (msg.userId !== req.user.id) return res.status(403).json({ message: 'Solo puedes borrar tus mensajes' });
    await msg.update({ deleted: true, deletedAt: new Date(), content: '', image: null, file: null, edited: false });
    const result = { ...msg.toJSON(), sender: safeUser(req.user) };
    const io = req.app.get('io');
    if (io) {
      const conv = await Conversation.findByPk(msg.conversationId, { include: [{ model: User, as: 'participants', attributes: ['id'] }] });
      for (const p of conv.participants) {
        io.to(`user:${p.id}`).emit('message:delete', { id: msg.id, conversationId: msg.conversationId });
      }
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function searchMessages(req, res, next) {
  try {
    const { id } = req.params;
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    const isMember = await ConversationParticipant.findOne({ where: { conversationId: id, userId: req.user.id } });
    if (!isMember) return res.status(403).json({ message: 'No eres miembro' });
    const messages = await Message.findAll({
      where: { conversationId: id, deleted: false, content: { [Op.iLike]: `%${q}%` } },
      order: [['createdAt', 'DESC']],
      limit: 50,
      include: [{ model: User, as: 'sender', attributes: { exclude: ['passwordHash'] } }]
    });
    res.json(messages.reverse().map((m) => ({ ...m.toJSON(), sender: safeUser(m.sender) })));
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const { id } = req.params;
    const isMember = await ConversationParticipant.findOne({ where: { conversationId: id, userId: req.user.id } });
    if (!isMember) return res.status(403).json({ message: 'No eres miembro' });
    const unread = await Message.findAll({
      where: { conversationId: id, userId: { [Op.ne]: req.user.id }, deleted: false }
    });
    await Promise.all(
      unread.map(async (m) => {
        const arr = Array.isArray(m.readBy) ? m.readBy : [];
        if (!arr.includes(req.user.id)) {
          await m.update({ readBy: [...arr, req.user.id] });
        }
      })
    );
    const io = req.app.get('io');
    if (io) {
      const conv = await Conversation.findByPk(id, { include: [{ model: User, as: 'participants', attributes: ['id'] }] });
      for (const p of conv.participants) {
        if (p.id !== req.user.id) {
          io.to(`user:${p.id}`).emit('messages:read', {
            conversationId: id,
            userId: req.user.id,
            username: req.user.username
          });
        }
      }
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function getMembers(req, res, next) {
  try {
    const { id } = req.params;
    const conv = await Conversation.findByPk(id, {
      include: [{ model: User, as: 'participants', attributes: { exclude: ['passwordHash'] } }]
    });
    if (!conv) return res.status(404).json({ message: 'Conversación no encontrada' });
    res.json({ participants: conv.participants, ownerId: conv.ownerId });
  } catch (err) {
    next(err);
  }
}

async function leaveGroup(req, res, next) {
  try {
    const { id } = req.params;
    const conv = await Conversation.findByPk(id, {
      include: [{ model: User, as: 'participants', attributes: ['id'] }]
    });
    if (!conv || conv.type !== 'group') return res.status(400).json({ message: 'No es un grupo' });
    if (!conv.participants.some((p) => p.id === req.user.id)) {
      return res.status(403).json({ message: 'No eres miembro' });
    }
    await ConversationParticipant.destroy({ where: { conversationId: id, userId: req.user.id } });
    const io = req.app.get('io');
    if (io) {
      const updated = await Conversation.findByPk(id, { include: [{ model: User, as: 'participants', attributes: { exclude: ['passwordHash'] } }] });
      for (const p of updated.participants) {
        io.to(`user:${p.id}`).emit('members:update', { conversationId: id, participants: updated.participants.map(safeUser) });
      }
      io.to(`user:${req.user.id}`).emit('conversation:removed', { conversationId: id });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list, getOrCreateDirect, createGroup, getMessages, sendMessage,
  editMessage, deleteMessage, searchMessages, markRead, getMembers, leaveGroup,
  toggleReaction, renameGroup, deleteGroup
};