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
    const result = conversations
      .map((c) => ({
        id: c.id,
        type: c.type,
        name: c.name,
        createdAt: c.createdAt,
        lastMessage: c.messages[0] || null,
        participants: c.participants.map(safeUser)
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

    const mine = await req.user.getConversations({ where: { type: 'direct' } });
    const existing = mine.find((c) => c.participants && c.participants.some((p) => p.id === otherUserId));
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

async function createGroup(req, res, next) {
  try {
    const { name, userIds } = req.body;
    if (!name) return res.status(400).json({ message: 'El nombre del grupo es obligatorio' });
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'Debes añadir al menos un miembro' });
    }
    const memberIds = [...new Set([req.user.id, ...userIds])];

    const conversation = await sequelize.transaction(async (t) => {
      const conv = await Conversation.create({ type: 'group', name }, { transaction: t });
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
    const before = req.query.before || undefined;

    const where = { conversationId };
    if (before) where.createdAt = { [Op.lt]: new Date(before) };

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
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'El mensaje no puede estar vacío' });
    }
    const isMember = await ConversationParticipant.findOne({
      where: { conversationId, userId: req.user.id }
    });
    if (!isMember) return res.status(403).json({ message: 'No eres miembro de esta conversación' });

    const message = await Message.create({
      conversationId,
      userId: req.user.id,
      content: content.trim()
    });
    const full = await Message.findByPk(message.id, {
      include: [{ model: User, as: 'sender', attributes: { exclude: ['passwordHash'] } }]
    });

    const result = { ...full.toJSON(), sender: safeUser(full.sender) };

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

module.exports = { list, getOrCreateDirect, createGroup, getMessages, sendMessage };