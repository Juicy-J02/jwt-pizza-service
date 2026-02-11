const request = require('supertest');
const express = require('express');
const orderRouter = require('./orderRouter');
const { DB } = require('../database/database');

jest.mock('../database/database');
jest.mock('./authRouter', () => ({
  authRouter: {
    authenticateToken: jest.fn((req, res, next) => {
      req.user = { 
        id: 4, 
        name: 'test diner', 
        email: 'diner@test.com',
        roles: [{ role: 'diner' }], 
        isRole: (role) => req.user.roles.some(r => r.role === role) 
      };
      next();
    }),
  },
}));

global.fetch = jest.fn();

const app = express();
app.use(express.json());
app.use('/api/order', orderRouter);

beforeEach(() => {
    jest.clearAllMocks();
});


test('Get Menu', async () => {
    const mockMenu = [{ id: 1, title: 'Veggie', price: 0.05 }];
    DB.getMenu.mockResolvedValue(mockMenu);

    const res = await request(app).get('/api/order/menu');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockMenu);
});

test('Create Order', async () => {
    const mockOrder = { id: 1, franchiseId: 1, storeId: 1, items: [] };
    DB.addDinerOrder.mockResolvedValue(mockOrder);

    global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ reportUrl: 'http://chaos.com', jwt: 'factory-jwt' }),
    });

    const res = await request(app)
        .post('/api/order')
        .send({ franchiseId: 1, storeId: 1, items: [] });

    expect(res.status).toBe(200);
    expect(res.body.order).toEqual(mockOrder);
    expect(res.body.jwt).toBe('factory-jwt');
    expect(global.fetch).toHaveBeenCalled();
});

test('Create Order Fail', async () => {
    DB.addDinerOrder.mockResolvedValue({ id: 1 });

    global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({ reportUrl: 'http://chaos.com' }),
    });

    const res = await request(app)
        .post('/api/order')
        .send({ franchiseId: 1, storeId: 1, items: [] });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Failed to fulfill order/);
});

test('Add Menu Item Fail', async () => {
    const res = await request(app)
        .put('/api/order/menu')
        .send({ title: 'New Pizza' });

    expect(res.status).toBe(403);
});

afterAll(() => {
    jest.restoreAllMocks();
});
  