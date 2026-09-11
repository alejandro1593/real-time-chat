const request = require('supertest');
const app = require('../src/app');

async function register(username, email, password = '123456') {
  return request(app).post('/api/auth/register').send({ username, email, password });
}

async function login(username, password = '123456') {
  return request(app).post('/api/auth/login').send({ username, password });
}

async function createUser(username) {
  const res = await register(username, `${username}@test.com`);
  return { ...res.body.user, token: res.body.token };
}

module.exports = { register, login, createUser };