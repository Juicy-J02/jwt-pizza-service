const { DB } = require('./database');
const { Role } = require('../model/model');

beforeAll(async () => {
    await DB.initialized;
});

test('get menu', async () => {
    const menu = await DB.getMenu();
    expect(Array.isArray(menu)).toBe(true);
});

test('add menu item', async () => {
    const item = { title: 'Veggie Pizza', description: 'Healthy', image: 'v.png', price: 12.99 };
    const result = await DB.addMenuItem(item);
    expect(result.id).toBeDefined();

    const menu = await DB.getMenu();
    expect(menu.some(m => m.title === 'Veggie Pizza')).toBe(true);
});

test('login user', async () => {
    const user = { name: 'Test User', email: `test-${Date.now()}@test.com`, password: 'password123', roles: [{ role: Role.Diner }] };
    const addedUser = await DB.addUser(user);
    expect(addedUser.id).toBeDefined();

    const retrievedUser = await DB.getUser(user.email, 'password123');
    expect(retrievedUser.name).toBe(user.name);
});

test('update user', async () => {
    const user = { name: 'Test User', email: `test-${Date.now()}@test.com`, password: 'password123', roles: [{ role: Role.Diner }] };
    const addedUser = await DB.addUser(user);
    expect(addedUser.id).toBeDefined();

    const updatedUser = await DB.updateUser(addedUser.id, 'Updated User', addedUser.email, addedUser.password);
    expect(updatedUser.name).toBe('Updated User');
});