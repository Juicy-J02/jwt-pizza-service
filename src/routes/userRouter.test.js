const request = require('supertest');
const express = require('express');
const userRouter = require('./userRouter');
const { DB } = require('../database/database');

jest.mock('../database/database', () => ({
  DB: {
    getUser: jest.fn(),
    updateUser: jest.fn(),
    getUserByEmail: jest.fn(),
    addUser: jest.fn(),
    getUsers: jest.fn(),
    getAllUsers: jest.fn().mockResolvedValue([[], false])
  },
  Role: {
    Admin: 'admin'
  }
}));

jest.mock('./authRouter', () => ({
  setAuth: jest.fn(async () => 'mock-token'),
  authRouter: {
    authenticateToken: jest.fn((req, res, next) => {
      const authHeader = req.headers['authorization'];
      if (!authHeader) {
        return res.status(401).json({ message: 'unauthorized' });
      }
      req.user = {
        id: 1,
        roles: [{ role: 'diner' }],
        isRole: (role) => req.user.roles.some(r => r.role === role)
      };
      next();
    })
  }
}));

const app = express();
app.use(express.json());
app.use('/api/user', userRouter);

beforeEach(() => {
  jest.clearAllMocks();
});

test('Get User', async () => {
  const res = await request(app)
    .get('/api/user/me')
    .set('Authorization', 'Bearer faketoken');

  expect(res.status).toBe(200);
  expect(res.body.id).toBe(1);
});

test('Update User success', async () => {
  DB.updateUser.mockResolvedValue({ id: 1, name: 'New Name', email: 'new@test.com' });

  const res = await request(app)
    .put('/api/user/1')
    .set('Authorization', 'Bearer faketoken')
    .send({ name: 'New Name', email: 'new@test.com', password: 'password123' });

  expect(res.status).toBe(200);
  expect(res.body.user.name).toBe('New Name');
  expect(res.body.token).toBe('mock-token');
});

test('Update User Fail', async () => {
  DB.updateUser.mockResolvedValue({ id: 2, name: 'Hacker', email: 'hack@test.com' });

  const res = await request(app)
    .put('/api/user/999')
    .set('Authorization', 'Bearer faketoken')
    .send({ name: 'Hacker' });

  expect(res.status).toBe(403);
  expect(res.body.message).toBe('unauthorized');
});

test('list users unauthorized', async () => {
  const listUsersRes = await request(app).get('/api/user');
  expect(listUsersRes.status).toBe(401);
});

test('list users', async () => {
  const [userToken] = await registerUser(request(app));

  const res = await request(app)
    .get('/api/user')
    .query({ page: 10, limit: 10, name: 'a' })
    .set('Authorization', 'Bearer ' + userToken);

  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('users');
  expect(res.body).toHaveProperty('more');
});

async function registerUser(service) {
  const testUser = {
    name: 'pizza diner',
    email: `${randomName()}@test.com`,
    password: 'a',
  };
  const registerRes = await service.post('/api/auth').send(testUser);

  return [registerRes.body.user, registerRes.body.token];
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

afterAll(() => {
  jest.restoreAllMocks();
});