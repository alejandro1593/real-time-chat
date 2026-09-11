require('dotenv').config();
const { sequelize, User, Conversation, Message, ConversationParticipant } = require('./models');

async function seed() {
  await sequelize.sync({ force: true });

  const users = [];
  for (const [username, email, password] of [
    ['eduardo', 'eduardo@chat.com', '123456'],
    ['ana', 'ana@chat.com', '123456'],
    ['jose', 'jose@chat.com', '123456']
  ]) {
    const [u] = await User.findOrCreate({ where: { username }, defaults: { email, passwordHash: password } });
    users.push(u);
  }

  const conv = await Conversation.create({ type: 'direct' });
  await ConversationParticipant.bulkCreate([
    { conversationId: conv.id, userId: users[0].id },
    { conversationId: conv.id, userId: users[1].id }
  ]);

  const grupo = await Conversation.create({ type: 'group', name: 'Equipo Backend' });
  await ConversationParticipant.bulkCreate([
    { conversationId: grupo.id, userId: users[0].id },
    { conversationId: grupo.id, userId: users[1].id },
    { conversationId: grupo.id, userId: users[2].id }
  ]);

  await Message.create({ conversationId: conv.id, userId: users[0].id, content: 'Hola Ana!' });
  await Message.create({ conversationId: conv.id, userId: users[1].id, content: 'Hola Edu, listo para el chat en tiempo real?' });

  console.log('Seed completado. Usuarios de prueba:');
  users.forEach((u) => console.log(`  - ${u.username} / 123456 (${u.email})`));
  process.exit(0);
}

seed().catch((err) => {
  console.error('Error en el seed:', err);
  process.exit(1);
});