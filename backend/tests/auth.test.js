const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');
const { register, login } = require('./helpers');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('POST /api/auth/register', () => {
  test('registro exitoso devuelve token y usuario', async () => {
    const res = await register('alice', 'alice@test.com', '123456');
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.username).toBe('alice');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  test('rechaza email inválido', async () => {
    const res = await register('bob', 'email-roto', '123456');
    expect(res.status).toBe(400);
  });

  test('rechaza contraseña corta', async () => {
    const res = await register('carol', 'carol@test.com', '123');
    expect(res.status).toBe(400);
  });

  test('rechaza username con caracteres inválidos', async () => {
    const res = await register('mal nombre!', 'mal@test.com', '123456');
    expect(res.status).toBe(400);
  });

  test('rechaza usuario duplicado con 409', async () => {
    await register('dave', 'dave@test.com', '123456');
    const res = await register('dave', 'dave2@test.com', '123456');
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  test('login exitoso', async () => {
    await register('erin', 'erin@test.com', '123456');
    const res = await login('erin', '123456');
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  test('login con contraseña incorrecta → 401', async () => {
    const res = await login('erin', 'incorrecta');
    expect(res.status).toBe(401);
  });

  test('login con usuario inexistente → 401', async () => {
    const res = await login('noexiste', '123456');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  test('sin token → 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('con token devuelve el usuario', async () => {
    const { body } = await register('frank', 'frank@test.com', '123456');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('frank');
  });
});