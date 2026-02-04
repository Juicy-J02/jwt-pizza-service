const request = require('supertest');
const app = require('../service');
const { DB } = require('../database/database');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

beforeAll(async () => {
    testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    expectValidJwt(testUserAuthToken);
});

test('register', async () => {
    const regRes = await request(app).post('/api/auth').send(testUser);
    expect(regRes.status).toBe(200);
    expectValidJwt(regRes.body.token);

    const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
    delete expectedUser.password;
    expect(regRes.body.user).toMatchObject(expectedUser);
});

test('login', async () => {
    const loginRes = await request(app).put('/api/auth').send(testUser);
    expect(loginRes.status).toBe(200);
    expectValidJwt(loginRes.body.token);

    const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
    delete expectedUser.password;
    expect(loginRes.body.user).toMatchObject(expectedUser);
});

function expectValidJwt(potentialJwt) {
    expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}

test('logout', async () => {
    const logoutRes = await request(app)
        .delete('/api/auth')
        .set('Authorization', `Bearer ${testUserAuthToken}`);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.user).toBeFalsy();
});

afterAll(async () => {
    await DB.logoutUser(testUserAuthToken);
});