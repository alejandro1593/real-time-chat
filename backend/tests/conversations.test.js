const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');
const { createUser } = require('./helpers');

let owner;
let partner;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  owner = await createUser('owner');
  partner = await createUser('partner');
});

afterAll(async () => {
  await sequelize.close();
});

const auth = (user) => `Bearer ${user.token}`;

describe('Conversaciones', () => {
  test('sin token en listado → 401', async () => {
    const res = await request(app).get('/api/conversations');
    expect(res.status).toBe(401);
  });

  test('crea DM y aparece en el listado', async () => {
    const res = await request(app)
      .post('/api/conversations/direct')
      .set('Authorization', auth(owner))
      .send({ userId: partner.id });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('direct');

    const list = await request(app)
      .get('/api/conversations')
      .set('Authorization', auth(owner));
    expect(list.status).toBe(200);
    expect(list.body.some((c) => c.type === 'direct')).toBe(true);
  });

  test('crea DM idempotente (no duplica)', async () => {
    const res = await request(app)
      .post('/api/conversations/direct')
      .set('Authorization', auth(owner))
      .send({ userId: partner.id });
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('direct');
  });

  test('rechaza direct con userId inválido', async () => {
    const res = await request(app)
      .post('/api/conversations/direct')
      .set('Authorization', auth(owner))
      .send({ userId: 'no-es-uuid' });
    expect(res.status).toBe(400);
  });

  test('crea grupo con miembros y ownerId', async () => {
    const res = await request(app)
      .post('/api/conversations/group')
      .set('Authorization', auth(owner))
      .send({ name: 'Equipo Test', userIds: [partner.id] });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('group');
    expect(res.body.ownerId).toBe(owner.id);
    expect(res.body.participants.length).toBe(2);
  });

  test('rechaza grupo sin miembros', async () => {
    const res = await request(app)
      .post('/api/conversations/group')
      .set('Authorization', auth(owner))
      .send({ name: 'Solitario', userIds: [] });
    expect(res.status).toBe(400);
  });

  test('lista miembros de la conversación', async () => {
    const list = await request(app)
      .get('/api/conversations')
      .set('Authorization', auth(owner));
    const group = list.body.find((c) => c.type === 'group');
    const res = await request(app)
      .get(`/api/conversations/${group.id}/members`)
      .set('Authorization', auth(owner));
    expect(res.status).toBe(200);
    expect(res.body.participants.length).toBe(2);
  });

  test('salir de un grupo lo elimina de la lista del usuario', async () => {
    const list = await request(app)
      .get('/api/conversations')
      .set('Authorization', auth(partner));
    const group = list.body.find((c) => c.type === 'group');
    const res = await request(app)
      .delete(`/api/conversations/${group.id}/participants/me`)
      .set('Authorization', auth(partner));
    expect(res.status).toBe(200);

    const after = await request(app)
      .get('/api/conversations')
      .set('Authorization', auth(partner));
    expect(after.body.some((c) => c.id === group.id)).toBe(false);
  });
});