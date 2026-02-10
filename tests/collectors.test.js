/**
 * Collector unit tests.
 * These test the collection logic with mocked external APIs.
 */

// Mock all external dependencies before requiring modules
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
      })),
      GoogleAuth: jest.fn().mockImplementation(() => ({})),
    },
    admob: jest.fn().mockReturnValue({
      accounts: {
        networkReport: {
          generate: jest.fn().mockResolvedValue({
            data: [
              {
                row: {
                  dimensionValues: {
                    APP: { value: 'ca-app-pub-123~456', displayLabel: 'Test App' },
                    COUNTRY: { value: 'US' },
                  },
                  metricValues: {
                    ESTIMATED_EARNINGS: { microsValue: '15230000' },
                    IMPRESSIONS: { integerValue: '10000' },
                    CLICKS: { integerValue: '150' },
                  },
                },
              },
            ],
          }),
        },
      },
    }),
    androidpublisher: jest.fn().mockReturnValue({
      edits: {
        insert: jest.fn().mockResolvedValue({ data: { id: 'edit-1' } }),
        delete: jest.fn().mockResolvedValue({}),
        tracks: {
          get: jest.fn().mockResolvedValue({
            data: {
              releases: [{
                name: '2.0.0',
                status: 'completed',
                versionCodes: ['42'],
              }],
            },
          }),
        },
      },
      reviews: {
        list: jest.fn().mockResolvedValue({
          data: {
            reviews: [{
              comments: [{ userComment: { starRating: 4 } }],
            }],
          },
        }),
      },
    }),
  },
}));

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    subscriptions: {
      list: jest.fn().mockResolvedValue({ data: [], has_more: false }),
    },
    charges: {
      list: jest.fn().mockResolvedValue({ data: [], has_more: false }),
    },
    refunds: {
      list: jest.fn().mockResolvedValue({ data: [], has_more: false }),
    },
  }));
});

jest.mock('node-fetch', () => jest.fn());

jest.mock('../src/models', () => {
  const upsert = jest.fn().mockResolvedValue([{}, true]);
  const create = jest.fn().mockResolvedValue({});
  const findAll = jest.fn().mockResolvedValue([]);
  return {
    App: { findAll, findOne: jest.fn().mockResolvedValue(null) },
    AdmobRevenue: { upsert },
    AppStoreData: { upsert },
    GooglePlayData: { upsert },
    StripeData: { upsert },
    CollectionLog: { create },
    initDB: jest.fn(),
    sequelize: {},
  };
});

// Set required env vars for tests
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
process.env.GOOGLE_REFRESH_TOKEN = 'test-refresh';
process.env.ADMOB_PUBLISHER_ID = 'pub-123';
process.env.STRIPE_SECRET_KEY = 'sk_test_123';
process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PATH = './keys/test.json';
process.env.GOOGLE_PLAY_PACKAGE_NAMES = 'com.test.app';

describe('Collectors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AdMob collector', () => {
    it('should collect and upsert revenue data', async () => {
      // Re-require to pick up mocks
      jest.isolateModules(async () => {
        const { AdmobRevenue, CollectionLog } = require('../src/models');
        const admob = require('../src/collectors/admob');

        await admob.collect();

        expect(AdmobRevenue.upsert).toHaveBeenCalledTimes(1);
        expect(AdmobRevenue.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            appId: 'ca-app-pub-123~456',
            appName: 'Test App',
            country: 'US',
            estimatedRevenue: 15.23,
            impressions: 10000,
            clicks: 150,
          })
        );
        expect(CollectionLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            source: 'admob',
            status: 'success',
          })
        );
      });
    });
  });

  describe('Stripe collector', () => {
    it('should collect and upsert stripe data', async () => {
      jest.isolateModules(async () => {
        const { StripeData, CollectionLog } = require('../src/models');
        const stripe = require('../src/collectors/stripe');

        await stripe.collect();

        expect(StripeData.upsert).toHaveBeenCalledTimes(1);
        expect(StripeData.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            activeSubscriptions: 0,
            mrr: 0,
          })
        );
        expect(CollectionLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            source: 'stripe',
            status: 'success',
          })
        );
      });
    });
  });

  describe('collectAll', () => {
    it('should run all collectors in parallel', async () => {
      jest.isolateModules(async () => {
        const collectors = require('../src/collectors');
        const summary = await collectors.collectAll();
        expect(summary).toHaveLength(4);
      });
    });
  });
});
