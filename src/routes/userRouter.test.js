const request = require('supertest');
const app = require('../service');
const { DB } = require('../database/database');

const testUser = { name: 'test diner', email: 'reg@test.com', password: 'a'};
let testUserAuthToken;
let userId;

beforeAll(async () => {
    testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
    const regRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = regRes.body.token;
    userId = regRes.body.user.id;
});

test('get user', async () => {
    const res = await request(app)
        .get('/api/user/me')
        .set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(testUser.name)
});

test('update user', async () => {
    const res = await request(app)
        .put(`/api/user/${userId}`)
        .set('Authorization', `Bearer ${testUserAuthToken}`)
        .send({ name: 'New Name', email: testUser.email, password: testUser.password });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('New Name');
});

test('delete user', async () => {
    const res = await request(app)
        .put(`/api/user/${userId}`)
        .set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(res.status).toBe(500);
});

test('list users', async () => {
    const res = await request(app)
        .put(`/api/user/${userId}`)
        .set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(res.status).toBe(500);
});

afterAll(async () => {
    await DB.logoutUser(testUserAuthToken);
});