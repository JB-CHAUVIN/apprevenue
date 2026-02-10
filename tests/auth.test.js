const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

// Mock models (Mongoose)
jest.mock('../src/models', () => {
  const mockUser = {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };
  return {
    User: mockUser,
    connectDB: jest.fn(),
  };
});

jest.mock('../src/services/email', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const { User } = require('../src/models');

const authRoutes = require('../src/routes/auth');
const { requireAuth } = require('../src/middleware/auth');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.set('view engine', 'ejs');
  app.set('views', require('path').join(__dirname, '../src/views'));
  app.use('/', authRoutes);
  app.get('/protected', requireAuth, (req, res) => res.json({ ok: true, user: req.user }));
  return app;
}

describe('Authentication', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/login', () => {
    it('should return 401 for invalid credentials', async () => {
      User.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/login')
        .send({ email: 'bad@test.com', password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('should return 403 for unverified user', async () => {
      const hash = bcrypt.hashSync('password123', 10);
      User.findOne.mockResolvedValue({
        _id: { toString: () => 'abc123' },
        email: 'user@test.com',
        passwordHash: hash,
        isVerified: false,
      });

      const res = await request(app)
        .post('/api/login')
        .send({ email: 'user@test.com', password: 'password123' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Email not verified');
    });

    it('should return a JWT for valid verified credentials', async () => {
      const hash = bcrypt.hashSync('password123', 10);
      User.findOne.mockResolvedValue({
        _id: { toString: () => 'abc123' },
        email: 'admin@test.com',
        passwordHash: hash,
        isVerified: true,
      });

      const res = await request(app)
        .post('/api/login')
        .send({ email: 'admin@test.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.expiresIn).toBe('24h');

      const decoded = jwt.verify(res.body.token, require('../src/config').jwtSecret);
      expect(decoded.email).toBe('admin@test.com');
    });
  });

  describe('requireAuth middleware', () => {
    it('should reject requests without token', async () => {
      const res = await request(app).get('/protected');
      expect(res.status).toBe(401);
    });

    it('should accept requests with valid Bearer token', async () => {
      // Mock User.findById to return a lean user object
      User.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: { toString: () => 'abc123' },
          email: 'admin@test.com',
          plan: 'free',
          displayName: 'Admin',
        }),
      });

      const token = jwt.sign(
        { id: 'abc123', email: 'admin@test.com' },
        require('../src/config').jwtSecret,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.user.email).toBe('admin@test.com');
    });

    it('should reject expired tokens', async () => {
      const token = jwt.sign(
        { id: 'abc123', email: 'admin@test.com' },
        require('../src/config').jwtSecret,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
    });

    it('should reject if user not found in DB', async () => {
      User.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const token = jwt.sign(
        { id: 'nonexistent', email: 'gone@test.com' },
        require('../src/config').jwtSecret,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
    });
  });
});
