const request = require('supertest');
const express = require('express');

// 1. MOCK LOGGER
jest.mock('../logger', () => ({
  log: jest.fn(),
  error: jest.fn(),
  httpLogger: (req, res, next) => next(),
}));

// 2. MOCK METRICS (Including all trackers used in the router)
jest.mock('../metrics', () => ({
  requestTracker: (req, res, next) => next(),
  activeUserTracker: (req, res, next) => next(),
  pizzaTracker: (req, res, next) => next(),
}));

// 3. MOCK DATABASE
jest.mock('../database/database', () => ({
  // We mock Role so Role.Admin exists for the middleware check
  Role: {
    Admin: 'admin',
    Diner: 'diner',
  },
  DB: {
    addDinerOrder: jest.fn(),
    getMenu: jest.fn(),
    addMenuItem: jest.fn(),
    getOrders: jest.fn(),
  },
}));

// 4. MOCK AUTH
jest.mock('./authRouter', () => ({
  authRouter: {
    authenticateToken: jest.fn((req, res, next) => {
      req.user = { 
        id: 4, 
        name: 'test diner', 
        email: 'diner@test.com',
        roles: [{ role: 'diner' }], 
        // Implement the helper function the router expects
        isRole: (role) => (req.user.roles || []).some(r => r.role === role) 
      };
      next();
    }),
  },
}));

// 5. REQUIRE AFTER MOCKS
const orderRouter = require('./orderRouter');
const { DB } = require('../database/database');

// 6. SETUP APP
global.fetch = jest.fn();
const app = express();
app.use(express.json());
app.use('/api/order', orderRouter);

describe('Order Router Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('Create Order Success', async () => {
    const mockOrder = { id: 1, franchiseId: 1, storeId: 1, items: [] };
    DB.addDinerOrder.mockResolvedValue(mockOrder);

    // Mock the factory fetch response
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ 
        reportUrl: 'http://chaos.com', 
        jwt: 'factory-jwt' 
      }),
    });

    const res = await request(app)
      .post('/api/order')
      .send({ franchiseId: 1, storeId: 1, items: [] });

    expect(res.status).toBe(200);
    expect(res.body.order).toEqual(mockOrder);
    expect(res.body.jwt).toBe('factory-jwt');
    expect(global.fetch).toHaveBeenCalled();
  });

  test('Create Order Fail at Factory', async () => {
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

  test('Add Menu Item Fail (Unauthorized)', async () => {
    // The auth mock sets the user role to 'diner'
    // The router expects Role.Admin (which we mocked as 'admin')
    const res = await request(app)
      .put('/api/order/menu')
      .send({ title: 'New Pizza', price: 0.01 });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/unable to add menu item/);
  });
});