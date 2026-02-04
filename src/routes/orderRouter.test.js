const request = require('supertest');
const app = require('../service');
const { DB } = require('../database/database');

const testUser = { name: 'test diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;
let userId;

beforeAll(async () => {
    testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
    const regRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = regRes.body.token;
    userId = regRes.body.user.id;
});

test('get menu', async () => {
    const res = await request(app).get('/api/order/menu');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
});

test('add menu - fail', async () => {
    const res = await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${testUserAuthToken}`)
        .send({ title: 'test pizza', price: 0.001 });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/unable to add menu item/);
});

test('get orders', async () => {
    const res = await request(app)
        .get('/api/order')
        .set('Authorization', `Bearer ${testUserAuthToken}`)
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('orders');
});

test('create order', async () => {
    const res = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${testUserAuthToken}`)
        .send({ franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: 'Veggie', price: 0.05 }]})
    expect(res.body).toHaveProperty('jwt')
});

afterAll(async () => {
    await DB.logoutUser(testUserAuthToken);
});