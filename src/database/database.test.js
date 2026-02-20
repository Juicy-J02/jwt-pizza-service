const mysql = require('mysql2/promise');
jest.mock('mysql2/promise');

mysql.createConnection = jest.fn().mockResolvedValue({
    query: jest.fn().mockResolvedValue([[]]),
    execute: jest.fn().mockResolvedValue([[]]),
    end: jest.fn().mockResolvedValue(null),
});

const { DB, Role } = require('./database');

let mockConnection;

beforeEach(() => {
    jest.clearAllMocks();
    mockConnection = {
        execute: jest.fn().mockResolvedValue([[]]),
        query: jest.fn().mockResolvedValue([[]]),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        end: jest.fn(),
    };
    jest.spyOn(DB, '_getConnection').mockResolvedValue(mockConnection);
    DB.initialized = Promise.resolve();
});

test('getMenu executes the correct SQL', async () => {
    const mockRows = [{ id: 1, title: 'Veggie' }];
    mockConnection.execute.mockResolvedValue([mockRows]);

    const result = await DB.getMenu();

    expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT \* FROM menu/),
        undefined
    );
    expect(result).toEqual(mockRows);
});

test('getUser throws 404 for non-existent user', async () => {
    mockConnection.execute.mockResolvedValue([[]]);

    await expect(DB.getUser('fake@test.com', 'pass'))
        .rejects.toThrow('unknown user');
});

test('Auth flow correctly handles JWT signatures', async () => {
    const token = 'header.payload.signature';

    await DB.loginUser(1, token);
    expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringMatching(/INSERT INTO auth/),
        ['signature', 1]
    );

    mockConnection.execute.mockResolvedValueOnce([[{ userId: 1 }]]);
    const loggedIn = await DB.isLoggedIn(token);
    expect(loggedIn).toBe(true);

    await DB.logoutUser(token);
    expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringMatching(/DELETE FROM auth/),
        ['signature']
    );
});

test('getOrders retrieves orders and iterates through order items', async () => {
    const mockUser = { id: 4 };

    mockConnection.execute
        .mockResolvedValueOnce([[{ id: 101, franchiseId: 1, storeId: 1, date: '2024-01-01' }]])
        .mockResolvedValueOnce([[{ id: 1, menuId: 1, description: 'Veggie Pizza', price: 0.05 }]]);

    const result = await DB.getOrders(mockUser, 1);

    expect(result.orders[0].items).toHaveLength(1);
    expect(result.orders[0].items[0].description).toBe('Veggie Pizza');
    expect(mockConnection.execute).toHaveBeenCalledTimes(2);
});

test('createFranchise validates admins and assigns roles', async () => {
    const franchiseReq = {
        name: 'Pizza Hut',
        admins: [{ email: 'admin@pizza.com' }]
    };

    mockConnection.execute
        .mockResolvedValueOnce([[{ id: 9, name: 'Admin Name' }]])
        .mockResolvedValueOnce([{ insertId: 100 }])
        .mockResolvedValueOnce([]);

    const result = await DB.createFranchise(franchiseReq);

    expect(result.id).toBe(100);
    expect(result.admins[0].id).toBe(9);
    expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringMatching(/INSERT INTO userRole/),
        [9, Role.Franchisee, 100]
    );
});

test('deleteFranchise uses transactions and deletes related data', async () => {
    mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }]);

    await DB.deleteFranchise(1);

    expect(mockConnection.beginTransaction).toHaveBeenCalled();
    expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringMatching(/DELETE FROM store WHERE franchiseId=\?/),
        [1]
    );
    expect(mockConnection.commit).toHaveBeenCalled();
});

test('getTokenSignature extracts the third part of a JWT', () => {
    const token = 'header.payload.signature';
    const sig = DB.getTokenSignature(token);
    expect(sig).toBe('signature');
});

test('getOffset calculates correctly', () => {
    const offset = DB.getOffset(2, 10);
    expect(offset).toEqual(10);
});

test('addUser correctly inserts franchisee roles', async () => {
    const mockUser = {
        name: 'Test',
        email: 't@test.com',
        password: 'password',
        roles: [{ role: Role.Franchisee, object: 'Pizza Hut' }]
    };

    mockConnection.execute
        .mockResolvedValueOnce([{ insertId: 10 }])
        .mockResolvedValueOnce([[{ id: 99 }]]);

    const result = await DB.addUser(mockUser);

    expect(result.id).toBe(10);
    expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringMatching(/INSERT INTO userRole/),
        [10, Role.Franchisee, 99]
    );
});

test('updateUser builds dynamic SQL based on provided fields', async () => {
    mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }]);

    jest.spyOn(DB, 'getUser').mockResolvedValue({ name: 'New Name', email: 'new@test.com' });

    await DB.updateUser(1, 'New Name', 'new@test.com', 'newPassword');

    expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE user SET password=.*email=.*name=.*/),
        undefined
    );
});

test('getAllUsers executes correct SQL and handles "more" correctly', async () => {
    const [users] = await DB.getAllUsers(0, 10, '*');
    expect(users.length).toEqual(0);
});

test('getFranchises returns stores for diners', async () => {
    const mockAuthUser = { isRole: () => false };
    mockConnection.execute
        .mockResolvedValueOnce([[{ id: 1, name: 'Pizza Hut' }, { id: 2, name: 'Dominos' }]])
        .mockResolvedValueOnce([[{ id: 10, name: 'SLC' }]]);

    const [franchises, more] = await DB.getFranchises(mockAuthUser, 0, 1);

    expect(more).toBe(true);
    expect(franchises[0].stores).toBeDefined();
});

test('getFranchise retrieves admins and calculates revenue', async () => {
    const mockFranchise = { id: 1, name: 'Pizza Hut' };

    mockConnection.execute
        .mockResolvedValueOnce([[{ id: 4, name: 'Admin', email: 'a@test.com' }]])
        .mockResolvedValueOnce([[{ id: 10, name: 'SLC', totalRevenue: 500 }]]);

    const result = await DB.getFranchise(mockFranchise);

    expect(result.admins).toHaveLength(1);
    expect(result.stores[0].totalRevenue).toBe(500);
});

test('getFranchise aggregates admin data and store revenue', async () => {
    const mockFranchise = { id: 1, name: 'Pizza Planet' };

    mockConnection.execute
        .mockResolvedValueOnce([
            [{ id: 10, name: 'Admin Alice', email: 'alice@test.com' }]
        ])
        .mockResolvedValueOnce([
            [
                { id: 101, name: 'Downtown Store', totalRevenue: 150.50 },
                { id: 102, name: 'Uptown Store', totalRevenue: 0 }
            ]
        ]);

    const result = await DB.getFranchise(mockFranchise);

    expect(result.admins).toHaveLength(1);
    expect(result.stores).toHaveLength(2);
    expect(result.stores[0].totalRevenue).toBe(150.50);
    expect(mockConnection.execute).toHaveBeenCalledTimes(2);
});

test('createStore inserts a new store record', async () => {
    const franchiseId = 1;
    const storeData = { name: 'SLC East' };

    mockConnection.execute.mockResolvedValueOnce([
        { insertId: 777 }
    ]);

    const result = await DB.createStore(franchiseId, storeData);

    expect(result).toEqual({
        id: 777,
        franchiseId: 1,
        name: 'SLC East'
    });
    expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringMatching(/INSERT INTO store/),
        [franchiseId, storeData.name]
    );
});

test('deleteStore executes the correct delete SQL', async () => {
    mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);

    await DB.deleteStore(1, 101);

    expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringMatching(/DELETE FROM store WHERE franchiseId=\? AND id=\?/),
        [1, 101]
    );
});
