const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const config = require('../src/config');

// Mock Mongoose models
jest.mock('../src/models', () => {
  const mockFind = jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    }),
  });

  const mockAggregate = jest.fn().mockResolvedValue([]);

  const mockFindById = jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue({
      _id: { toString: () => 'user123' },
      email: 'admin@test.com',
      plan: 'free',
      displayName: 'Admin',
    }),
  });

  return {
    connectDB: jest.fn(),
    User: {
      findById: mockFindById,
      findOne: jest.fn(),
    },
    App: {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
      findOneAndUpdate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
      countDocuments: jest.fn().mockResolvedValue(0),
    },
    AdmobRevenue: { find: mockFind, aggregate: mockAggregate },
    AppStoreData: { find: mockFind },
    GooglePlayData: { find: mockFind },
    StripeData: { find: mockFind },
    CollectionLog: {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
      create: jest.fn().mockResolvedValue({}),
    },
  };
});

jest.mock('../src/collectors', () => ({
  collectForUser: jest.fn().mockResolvedValue([
    { source: 'admob', status: 'fulfilled' },
    { source: 'appstore', status: 'fulfilled' },
    { source: 'googleplay', status: 'fulfilled' },
    { source: 'stripe', status: 'fulfilled' },
  ]),
}));

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const apiRoutes = require('../src/routes/api');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', apiRoutes);
  return app;
}

function authHeader() {
  const token = jwt.sign({ id: 'user123', email: 'admin@test.com' }, config.jwtSecret, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

describe('API Routes', () => {
  const app = createApp();

  it('GET /api/admob should return data', async () => {
    const res = await request(app)
      .get('/api/admob')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/appstore should return data', async () => {
    const res = await request(app)
      .get('/api/appstore')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
  });

  it('GET /api/googleplay should return data', async () => {
    const res = await request(app)
      .get('/api/googleplay')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
  });

  it('GET /api/stripe should return data', async () => {
    const res = await request(app)
      .get('/api/stripe')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
  });

  it('GET /api/logs should return collection logs', async () => {
    const res = await request(app)
      .get('/api/logs')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
  });

  it('POST /api/collect should trigger collection', async () => {
    const res = await request(app)
      .post('/api/collect')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
  });

  it('GET /api/summary should return unified summary', async () => {
    const res = await request(app)
      .get('/api/summary?days=7')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.period).toBeDefined();
    expect(res.body.period.days).toBe(7);
  });

  it('GET /api/apps should return app list', async () => {
    const res = await request(app)
      .get('/api/apps')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('should reject unauthenticated requests', async () => {
    const res = await request(app).get('/api/admob');
    expect(res.status).toBe(401);
  });
});
