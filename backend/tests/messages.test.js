const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');
const { createUser } = require('./helpers');

let alice;
let bob;
let conv;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  alice = await createUser('alice');
  bob = await createUser('bob');
  const res = await request(app)
    .post('/api/conversations/direct')
    .set('Authorization', `Bearer ${alice.token}`)
    .send({ userId: bob.id });
  conv = res.body;
});

afterAll(async () => {
  await sequelize.close();
});

const auth = (u) => `Bearer ${u.token}`;

describe('Mensajes', () => {
  test('envía un mensaje de texto', async () => {
    const res = await request(app)
      .post(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', auth(alice))
      .send({ content: 'Hola Bob' });
    expect(res.status).toBe(201);
    expect(res.body.content).toBe('Hola Bob');
    expect(res.body.deleted).toBe(false);
  });

  test('envía mensaje con imagen', async () => {
    const res = await request(app)
      .post(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', auth(alice))
      .send({ content: 'Mira esto', image: 'data:image/png;base64,AAA' });
    expect(res.status).toBe(201);
    expect(res.body.image).toMatch(/^data:image/);
  });

  test('rechaza mensaje vacío', async () => {
    const res = await request(app)
      .post(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', auth(alice))
      .send({ content: '   ' });
    expect(res.status).toBe(400);
  });

  test('listado de mensajes devuelve los enviados', async () => {
    const res = await request(app)
      .get(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', auth(alice));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  test('paginación: before devuelve mensajes anteriores', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post(`/api/conversations/${conv.id}/messages`)
        .set('Authorization', auth(alice))
        .send({ content: `mensaje ${i}` });
    }
    const res = await request(app)
      .get(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', auth(alice));
    const page1 = await request(app)
      .get(`/api/conversations/${conv.id}/messages?limit=3`)
      .set('Authorization', auth(alice));
    expect(page1.body.length).toBe(3);
    const oldestId = page1.body[0].id;
    const page2 = await request(app)
      .get(`/api/conversations/${conv.id}/messages?limit=3&before=${oldestId}`)
      .set('Authorization', auth(alice));
    expect(page2.body.length).toBeGreaterThan(0);
    const ids = new Set([...page1.body.map((m) => m.id), ...page2.body.map((m) => m.id)]);
    expect(ids.size).toBe(page1.body.length + page2.body.length);
  });

  test('búsqueda de mensajes por texto', async () => {
    const res = await request(app)
      .get(`/api/conversations/${conv.id}/messages/search?q=Hola`)
      .set('Authorization', auth(alice));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.some((m) => m.content.includes('Hola'))).toBe(true);
  });

  test('marcar como leído actualiza readBy', async () => {
    const res = await request(app)
      .post(`/api/conversations/${conv.id}/read`)
      .set('Authorization', auth(bob));
    expect(res.status).toBe(200);
    const msgs = await request(app)
      .get(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', auth(bob));
    const received = msgs.body.filter((m) => m.userId === alice.id);
    expect(received.length).toBeGreaterThan(0);
    expect(received.every((m) => m.readBy.includes(bob.id))).toBe(true);
  });

  test('editar tu propio mensaje marca edited', async () => {
    const sent = await request(app)
      .post(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', auth(alice))
      .send({ content: 'versión 1' });
    const res = await request(app)
      .put(`/api/conversations/${conv.id}/messages/${sent.body.id}`)
      .set('Authorization', auth(alice))
      .send({ content: 'versión 2' });
    expect(res.status).toBe(200);
    expect(res.body.content).toBe('versión 2');
    expect(res.body.edited).toBe(true);
  });

  test('no puedes editar mensajes ajenos → 403', async () => {
    const sent = await request(app)
      .post(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', auth(alice))
      .send({ content: 'mío' });
    const res = await request(app)
      .put(`/api/conversations/${conv.id}/messages/${sent.body.id}`)
      .set('Authorization', auth(bob))
      .send({ content: 'intruso' });
    expect(res.status).toBe(403);
  });

  test('borrar mensaje propio lo oculta', async () => {
    const sent = await request(app)
      .post(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', auth(alice))
      .send({ content: 'borrame' });
    const res = await request(app)
      .delete(`/api/conversations/${conv.id}/messages/${sent.body.id}`)
      .set('Authorization', auth(alice));
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });

  test('no puedes borrar mensajes ajenos → 403', async () => {
    const sent = await request(app)
      .post(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', auth(alice))
      .send({ content: 'no toques' });
    const res = await request(app)
      .delete(`/api/conversations/${conv.id}/messages/${sent.body.id}`)
      .set('Authorization', auth(bob));
    expect(res.status).toBe(403);
  });

  test('no puedes mandar mensajes si no eres miembro → 403', async () => {
    const outsider = await createUser('outsider');
    const res = await request(app)
      .post(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', auth(outsider))
      .send({ content: 'colado' });
    expect(res.status).toBe(403);
  });

  test('respuesta a un mensaje incluye el replyTo', async () => {
    const original = await request(app)
      .post(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', auth(alice))
      .send({ content: 'mensaje base' });
    const reply = await request(app)
      .post(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', auth(alice))
      .send({ content: 'mi respuesta', replyToId: original.body.id });
    expect(reply.status).toBe(201);
    expect(reply.body.replyTo).toBeTruthy();
    expect(reply.body.replyTo.content).toBe('mensaje base');
  });

  test('adjuntar un archivo lo devuelve en el mensaje', async () => {
    const res = await request(app)
      .post(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', auth(alice))
      .send({ content: 'documento', file: { name: 'apuntes.pdf', size: 1024, mime: 'application/pdf', dataUrl: 'data:application/pdf;base64,AAAA' } });
    expect(res.status).toBe(201);
    expect(res.body.file).toBeTruthy();
    expect(res.body.file.name).toBe('apuntes.pdf');
  });

  test('reaccionar a un mensaje la añade y conserva al autor original', async () => {
    const sent = await request(app)
      .post(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', auth(alice))
      .send({ content: 'dame cora' });
    const react = await request(app)
      .put(`/api/conversations/${conv.id}/messages/${sent.body.id}/reactions`)
      .set('Authorization', auth(bob))
      .send({ emoji: '❤️' });
    expect(react.status).toBe(200);
    expect(react.body.reactions['❤️']).toContain(bob.id);
    expect(react.body.sender.id).toBe(alice.id);
  });

  test('quitar reacción la elimina', async () => {
    const sent = await request(app)
      .post(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', auth(alice))
      .send({ content: 'reaccion dos veces' });
    await request(app)
      .put(`/api/conversations/${conv.id}/messages/${sent.body.id}/reactions`)
      .set('Authorization', auth(alice))
      .send({ emoji: '👍' });
    const off = await request(app)
      .put(`/api/conversations/${conv.id}/messages/${sent.body.id}/reactions`)
      .set('Authorization', auth(alice))
      .send({ emoji: '👍' });
    expect(off.body.reactions['👍'] || []).not.toContain(alice.id);
  });
});