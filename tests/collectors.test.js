/**
 * Collector unit tests.
 * These test the collection logic with mocked external APIs and Mongoose models.
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
  const findOneAndUpdate = jest.fn().mockResolvedValue({});
  const create = jest.fn().mockResolvedValue({});
  const find = jest.fn().mockResolvedValue([]);
  return {
    connectDB: jest.fn(),
    App: { find, findOne: jest.fn().mockResolvedValue(null) },
    AdmobRevenue: { findOneAndUpdate },
    AppStoreData: { findOneAndUpdate },
    GooglePlayData: { findOneAndUpdate },
    StripeData: { findOneAndUpdate },
    CollectionLog: { create },
    UserCredential: {
      find: jest.fn().mockResolvedValue([]),
    },
  };
});

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('Collectors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AdMob collector', () => {
    it('should collect and upsert revenue data', async () => {
      jest.isolateModules(async () => {
        const { AdmobRevenue, CollectionLog } = require('../src/models');
        const admob = require('../src/collectors/admob');

        const credentials = {
          clientId: 'test-client-id',
          clientSecret: 'test-secret',
          refreshToken: 'test-refresh',
          publisherId: 'pub-123',
        };

        await admob.collect('user123', credentials);

        expect(AdmobRevenue.findOneAndUpdate).toHaveBeenCalledTimes(1);
        expect(AdmobRevenue.findOneAndUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'user123',
            appId: 'ca-app-pub-123~456',
            country: 'US',
          }),
          expect.objectContaining({
            estimatedRevenue: 15.23,
            impressions: 10000,
            clicks: 150,
          }),
          expect.objectContaining({ upsert: true })
        );
        expect(CollectionLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'user123',
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

        const credentials = { secretKey: 'sk_test_123' };

        await stripe.collect('user123', credentials);

        expect(StripeData.findOneAndUpdate).toHaveBeenCalledTimes(1);
        expect(StripeData.findOneAndUpdate).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 'user123' }),
          expect.objectContaining({
            activeSubscriptions: 0,
            mrr: 0,
          }),
          expect.objectContaining({ upsert: true })
        );
        expect(CollectionLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'user123',
            source: 'stripe',
            status: 'success',
          })
        );
      });
    });
  });

  describe('collectForUser', () => {
    it('should run collectors for configured sources', async () => {
      jest.isolateModules(async () => {
        const { UserCredential } = require('../src/models');
        UserCredential.find.mockResolvedValue([
          { source: 'stripe', credentials: { secretKey: 'sk_test_123' } },
        ]);

        const { collectForUser } = require('../src/collectors');
        const summary = await collectForUser('user123');
        expect(Array.isArray(summary)).toBe(true);
      });
    });
  });
});
