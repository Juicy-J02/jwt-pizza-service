const { DB } = require('./database');

beforeAll(async () => {
    await DB.initialized;
});

test('get Menu returns an array', async () => {
    const menu = await DB.getMenu();
    expect(Array.isArray(menu)).toBe(true);
});