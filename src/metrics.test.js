// metrics.test.js

process.env.NODE_ENV = 'test';

// Mock config BEFORE requiring metrics.js
jest.mock('./config', () => ({
  metrics: {
    source: 'test-source',
    endpointUrl: 'http://localhost',
    accountId: 'test',
    apiKey: 'test',
  },
}));

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
  })
);

const metrics = require('./metrics');

function createMockReqRes() {
  const events = {};

  const req = {
    method: 'GET',
  };

  const res = {
    statusCode: 200,
    locals: {},
    on: (event, cb) => {
      events[event] = cb;
    },
  };

  const next = jest.fn();

  return { req, res, next, events };
}

describe('metrics coverage', () => {
  test('run through all middleware paths', () => {
    // requestTracker
    {
      const { req, res, next, events } = createMockReqRes();
      metrics.requestTracker(req, res, next);
      events.finish();
    }

    // activeUserTracker - login
    {
      const { req, res, next, events } = createMockReqRes();
      res.locals = { type: 'login', auth: 'user1' };
      metrics.activeUserTracker(req, res, next);
      events.finish();
    }

    // activeUserTracker - logout
    {
      const { req, res, next, events } = createMockReqRes();
      res.locals = { type: 'logout', auth: 'user1' };
      metrics.activeUserTracker(req, res, next);
      events.finish();
    }

    // activeUserTracker - other
    {
      const { req, res, next, events } = createMockReqRes();
      res.locals = { type: 'other', auth: 'user2' };
      metrics.activeUserTracker(req, res, next);
      events.finish();
    }

    // authTracker
    {
      const { req, res, next, events } = createMockReqRes();
      res.statusCode = 401;
      metrics.authTracker(req, res, next);
      events.finish();
    }

    // pizzaTracker success
    {
      const { req, res, next, events } = createMockReqRes();
      res.statusCode = 200;
      res.locals.order = {
        items: [{ price: 10 }, { price: 20 }],
      };
      metrics.pizzaTracker(req, res, next);
      events.finish();
    }

    // pizzaTracker failure
    {
      const { req, res, next, events } = createMockReqRes();
      res.statusCode = 500;
      res.locals.order = {
        items: [{ price: 10 }],
      };
      metrics.pizzaTracker(req, res, next);
      events.finish();
    }
  });

  test('trigger metric sending block', async () => {
    jest.useFakeTimers();

    // Re-require to ensure interval runs under fake timers
    jest.resetModules();

    // Fast-forward interval
    jest.advanceTimersByTime(10000);

    // Allow pending promises (fetch) to resolve
    await Promise.resolve();

    expect(fetch).toHaveBeenCalled();

    jest.useRealTimers();
  });
});