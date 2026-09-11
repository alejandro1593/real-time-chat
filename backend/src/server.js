require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const setupSocket = require('./sockets');
const { sequelize, User, Conversation, Message, ConversationParticipant } = require('./models');

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || '*' }
});
app.set('io', io);
setupSocket(io);

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    console.log('Base de datos conectada y sincronizada');
    server.listen(PORT, () => console.log(`API REST + Socket.io en el puerto ${PORT}`));
  } catch (err) {
    console.error('No se pudo iniciar el servidor:', err.message);
    process.exit(1);
  }
})();