global.fetch = jest.fn();

const request = require('supertest');
const express = require('express');

jest.mock('../metrics', () => ({
    requestTracker: (req, res, next) => next(),
    activeUserTracker: (req, res, next) => next(),
    pizzaTracker: (req, res, next) => next(),
}));

jest.mock('../logger', () => ({
    httpLogger: (req, res, next) => next(),
    log: jest.fn(),
    error: jest.fn(),
}));

jest.mock('../database/database', () => ({
    DB: {
        addDinerOrder: jest.fn(),
    },
}));

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

const orderRouter = require('./orderRouter');
const { DB } = require('../database/database');

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
});
