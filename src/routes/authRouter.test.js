const request = require('supertest');
const express = require('express');
const { authRouter, setAuthUser } = require('./authRouter');
const { DB } = require('../database/database');
const jwt = require('jsonwebtoken');

jest.mock('../database/database');
jest.mock('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(setAuthUser); 
app.use('/api/auth', authRouter);

const mockUser = { id: 1, name: 'pizza diner', email: 'd@jwt.com', roles: [{ role: 'diner' }] };
const mockToken = 'mock-jwt-token';

beforeEach(() => {
  jest.clearAllMocks();
});

test('Register', async () => {
    DB.addUser.mockResolvedValue(mockUser);
    jwt.sign.mockReturnValue(mockToken);
    DB.loginUser.mockResolvedValue(true);

    const res = await request(app)
        .post('/api/auth')
        .send({ name: 'pizza diner', email: 'd@jwt.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe(mockToken);
    expect(DB.addUser).toHaveBeenCalled();
});

test('Register Fail', async () => {
    const res = await request(app).post('/api/auth').send({ name: 'incomplete' });
    expect(res.status).toBe(400);
});

test('Login', async () => {
    DB.getUser.mockResolvedValue(mockUser);
    jwt.sign.mockReturnValue(mockToken);

    const res = await request(app)
        .put('/api/auth')
        .send({ email: 'd@jwt.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('d@jwt.com');
    expect(DB.loginUser).toHaveBeenCalledWith(mockUser.id, mockToken);
});

test('Logout', async () => {
    DB.isLoggedIn.mockResolvedValue(true);
    jwt.verify.mockReturnValue(mockUser);
    DB.logoutUser.mockResolvedValue(true);

    const res = await request(app)
        .delete('/api/auth')
        .set('Authorization', `Bearer ${mockToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('logout successful');
    expect(DB.logoutUser).toHaveBeenCalledWith(mockToken);
});

test('Logout Error', async () => {
    const res = await request(app).delete('/api/auth'); // No token provided
    expect(res.status).toBe(401);
});

afterAll(() => {
  jest.restoreAllMocks();
});
