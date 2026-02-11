const request = require('supertest');
const express = require('express');
const franchiseRouter = require('./franchiseRouter');
const { DB, Role } = require('../database/database');

jest.mock('../database/database');
jest.mock('./authRouter', () => ({
    authRouter: {
    authenticateToken: jest.fn((req, res, next) => {
        req.user = { 
        id: 4, 
        roles: [{ role: 'diner' }], 
        isRole: (role) => req.user.roles.some(r => r.role === role) 
        };
        next();
    }),
    },
}));

const { authRouter } = require('./authRouter');

const app = express();
app.use(express.json());
app.use('/api/franchise', franchiseRouter);


beforeEach(() => {
    jest.clearAllMocks();
});

test('List Franchises', async () => {
    const mockFranchises = [{ id: 1, name: 'pizzaPocket' }];
    DB.getFranchises.mockResolvedValue([mockFranchises, true]);

    const res = await request(app).get('/api/franchise');

    expect(res.status).toBe(200);
    expect(res.body.franchises).toEqual(mockFranchises);
    expect(res.body.more).toBe(true);
});

test('Get User Franchises', async () => {
    const mockFranchises = [{ id: 1, name: 'pizzaPocket' }];
    DB.getUserFranchises.mockResolvedValue(mockFranchises);

    const res = await request(app).get('/api/franchise/4');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockFranchises);
    expect(DB.getUserFranchises).toHaveBeenCalledWith(4);
});

test('Create Franchise', async () => {
    authRouter.authenticateToken.mockImplementationOnce((req, res, next) => {
        req.user = { id: 1, roles: [{ role: 'admin' }], isRole: () => true };
        next();
    });

    const mockResponse = { id: 1, name: 'pizzaPocket' };
    DB.createFranchise.mockResolvedValue(mockResponse);

    const res = await request(app)
        .post('/api/franchise')
        .send({ name: 'pizzaPocket', admins: [{ email: 'f@jwt.com' }] });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('pizzaPocket');
});

test('Create Store', async () => {
    const franchiseId = 1;
    const mockFranchise = { id: franchiseId, admins: [{ id: 4 }] };

    DB.getFranchise.mockResolvedValue(mockFranchise);
    DB.createStore.mockResolvedValue({ id: 10, name: 'SLC' });

    const res = await request(app)
        .post(`/api/franchise/${franchiseId}/store`)
        .send({ name: 'SLC' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('SLC');
});

test('Delete Franchise', async () => {
    DB.deleteFranchise.mockResolvedValue(true);

    const res = await request(app).delete('/api/franchise/1');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('franchise deleted');
});

test('DELETE /api/franchise/:fid/store/:sid - success for franchise admin', async () => {
    const franchiseId = 1;
    const storeId = 10;

    DB.getFranchise.mockResolvedValue({ id: franchiseId, admins: [{ id: 4 }] });
    DB.deleteStore.mockResolvedValue(true);

    const res = await request(app).delete(`/api/franchise/${franchiseId}/store/${storeId}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('store deleted');
    expect(DB.deleteStore).toHaveBeenCalledWith(franchiseId, storeId);
});

afterAll(() => {
    jest.restoreAllMocks();
});
