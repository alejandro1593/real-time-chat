const jwt = require('jsonwebtoken');
const { User, Message, Conversation, ConversationParticipant } = require('../models');

module.exports = function setupSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error('No autorizado'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.userId = payload.id;
      next();
    } catch (err) {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId;

    const user = await User.findByPk(userId).catch(() => null);
    if (!user) return socket.disconnect(true);

    await user.update({ online: true, lastSeen: new Date() });
    socket.join(`user:${userId}`);
    socket.broadcast.emit('presence:update', { userId, online: true, username: user.username });

    socket.on('message:send', async (payload, callback) => {
      try {
        const { conversationId, content, image } = payload || {};
        if (!conversationId || ((!content || !content.trim()) && !image)) {
          return callback && callback({ ok: false, message: 'Datos inválidos' });
        }
        const isMember = await ConversationParticipant.findOne({
          where: { conversationId, userId }
        });
        if (!isMember) {
          return callback && callback({ ok: false, message: 'No eres miembro' });
        }
        const message = await Message.create({
          conversationId,
          userId,
          content: (content || '').trim(),
          image: image || null,
          readBy: []
        });
        const result = {
          id: message.id,
          conversationId: message.conversationId,
          content: message.content,
          image: message.image,
          edited: message.edited,
          deleted: message.deleted,
          readBy: message.readBy,
          createdAt: message.createdAt,
          sender: { id: user.id, username: user.username, email: user.email, online: user.online }
        };
        const conversation = await Conversation.findByPk(conversationId, {
          include: [{ model: User, as: 'participants', attributes: ['id'] }]
        });
        for (const p of conversation.participants) {
          io.to(`user:${p.id}`).emit('message:new', result);
        }
        callback && callback({ ok: true, message: result });
      } catch (err) {
        console.error('Socket message:send', err);
        callback && callback({ ok: false, message: 'Error del servidor' });
      }
    });

    socket.on('typing', async ({ conversationId, typing }) => {
      const isMember = await ConversationParticipant.findOne({ where: { conversationId, userId } });
      if (!isMember) return;
      const conversation = await Conversation.findByPk(conversationId, {
        include: [{ model: User, as: 'participants', attributes: ['id'] }]
      });
      for (const p of conversation.participants) {
        if (p.id !== userId) {
          io.to(`user:${p.id}`).emit('typing', { conversationId, userId, username: user.username, typing });
        }
      }
    });

    socket.on('disconnect', async () => {
      const stillConnected = [...io.of('/').sockets.values()].some(
        (s) => s.data.userId === userId
      );
      if (!stillConnected) {
        await user.update({ online: false, lastSeen: new Date() }).catch(() => {});
        io.emit('presence:update', { userId, online: false, username: user.username });
      }
    });
  });
};