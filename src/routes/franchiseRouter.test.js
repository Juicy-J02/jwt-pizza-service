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

test('get franchises', async () => {
    const res = await request(app).get('/api/franchise');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('franchises');
    expect(Array.isArray(res.body.franchises)).toBe(true);
});

test('create franchises - fail', async () => {
    const res = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${testUserAuthToken}`)
        .send({ name: 'Invalid Franchise', admins: [{ email: 'f@jwt.com' }] });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/unable to create a franchise/);
});

test('get user franchises', async () => {
    const res = await request(app)
        .get(`/api/franchise/${userId}`)
        .set('Authorization', `Bearer ${testUserAuthToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
});

test('delete store - fail', async () => {
    const res = await request(app)
        .delete('/api/franchise/1/store/9999')
        .set('Authorization', `Bearer ${testUserAuthToken}`)

    expect(res.status).toBe(403)
});

test('create store - fail', async () => {
    const res = await request(app)
        .post('/api/franchise/9999/store')
        .set('Authorization', `Bearer ${testUserAuthToken}`)
        .send({ name: 'No Where Store' });

    expect(res.status).toBe(403);
});

test('delete franchise', async () => {
    const res = await request(app).delete('/api/franchise/1');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('franchise deleted');
});

afterAll(async () => {
    await DB.logoutUser(testUserAuthToken);
});