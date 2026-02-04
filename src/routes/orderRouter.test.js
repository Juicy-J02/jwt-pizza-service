const request = require('supertest');
const app = require('../service');
const { DB } = require('../database/database');
const { Role } = require('../model/model');

const testUser = { name: 'test diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;
let adminToken;
let franchiseId;
let storeId;
let menuId;

beforeAll(async () => {
    testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
    const regRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = regRes.body.token;
    await DB.initialized;

    const adminUser = { name: 'Test Admin', email: `admin-${Date.now()}@test.com`, password: 'password123', roles: [{ role: Role.Admin }] };
    await DB.addUser(adminUser);
    const loginRes = await request(app).put('/api/auth').send({ email: adminUser.email, password: adminUser.password });
    adminToken = loginRes.body.token;

    const franchiseRes = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'T', admins: [{ email: adminUser.email }] });
    franchiseId = franchiseRes.body.id;

    const storeRes = await request(app)
        .post(`/api/franchise/${franchiseId}/store`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Main St Store' });
    storeId = storeRes.body.id;

    const menuRes = await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Test Pizza', description: 'Yum', image: 't.png', price: 0.01 });
    menuId = menuRes.body[0].id;
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
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
            franchiseId: franchiseId,
            storeId: storeId,
            items: [{ menuId: menuId, description: 'Test Pizza', price: 0.01 }]
        });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('jwt');
});

afterAll(async () => {
    await request(app)
        .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

    await request(app)
        .delete(`/api/franchise/${franchiseId}`)
        .set('Authorization', `Bearer ${adminToken}`);

    await request(app)
        .delete('/api/auth')
        .set('Authorization', `Bearer ${adminToken}`);

    await DB.logoutUser(testUserAuthToken);
});