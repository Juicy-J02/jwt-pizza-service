const request = require('supertest');
const express = require('express');
const userRouter = require('./userRouter');
const { DB } = require('../database/database');
const { setAuth } = require('./authRouter');

jest.mock('../database/database');
jest.mock('./authRouter', () => ({
    authRouter: {
    authenticateToken: jest.fn((req, res, next) => {
        req.user = { id: 1, roles: [{ role: 'diner' }], isRole: (role) => req.user.roles.some(r => r.role === role) };
        next();
    }),
    },
    setAuth: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use('/api/user', userRouter);

beforeEach(() => {
    jest.clearAllMocks();
});

test('Get User', async () => {
    const res = await request(app).get('/api/user/me');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
});

test('Update User', async () => {
    const updatedUser = { id: 1, name: 'New Name', email: 'new@test.com' };
    DB.updateUser.mockResolvedValue(updatedUser);
    setAuth.mockResolvedValue('mock-new-token');

    const res = await request(app)
        .put('/api/user/1')
        .send({ name: 'New Name', email: 'new@test.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('New Name');
    expect(res.body.token).toBe('mock-new-token');
});

test('Update User Fail', async () => {
    const res = await request(app)
    .put('/api/user/999')
    .send({ name: 'Hacker' });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('unauthorized');
});

afterAll(() => {
    jest.restoreAllMocks();
});
  