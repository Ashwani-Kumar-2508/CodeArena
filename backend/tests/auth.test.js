/**
 * CodeArena Test Suite — Auth Service Unit Tests
 *
 * Tests: email validation, password policy, registration, login flow,
 * account locking, and email verification.
 */

const authService = require('../src/services/authService');

// Mock Prisma and bcrypt to keep tests fast and DB-free
jest.mock('../src/config/db', () => ({
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  }
}));

jest.mock('../src/config/mailer', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue({ success: true })
}));

jest.mock('../src/config/jwt', () => ({
  generateToken: jest.fn().mockReturnValue('mock_token_abc123')
}));

const prisma = require('../src/config/db');
const bcrypt = require('bcryptjs');

describe('Auth Service — Email Validation', () => {
  test('accepts valid email addresses', () => {
    expect(authService.validateEmailFormat('user@example.com')).toBeNull();
    expect(authService.validateEmailFormat('test.user+tag@sub.domain.org')).toBeNull();
  });

  test('rejects missing email', () => {
    expect(authService.validateEmailFormat(null)).toBeTruthy();
    expect(authService.validateEmailFormat('')).toBeTruthy();
    expect(authService.validateEmailFormat(undefined)).toBeTruthy();
  });

  test('rejects malformed email addresses', () => {
    expect(authService.validateEmailFormat('notanemail')).toBeTruthy();
    expect(authService.validateEmailFormat('@domain.com')).toBeTruthy();
    expect(authService.validateEmailFormat('user@')).toBeTruthy();
    expect(authService.validateEmailFormat('user @example.com')).toBeTruthy();
  });
});

describe('Auth Service — Password Policy', () => {
  test('accepts strong passwords', () => {
    expect(authService.validatePasswordPolicy('SecureP@ss1')).toBeNull();
    expect(authService.validatePasswordPolicy('MyStr0ngPass')).toBeNull();
    expect(authService.validatePasswordPolicy('Ab1defghij')).toBeNull();
  });

  test('rejects passwords shorter than 8 characters', () => {
    expect(authService.validatePasswordPolicy('Abc1')).toBeTruthy();
    expect(authService.validatePasswordPolicy('Ab1')).toBeTruthy();
  });

  test('rejects weak/common passwords', () => {
    expect(authService.validatePasswordPolicy('password123')).toBeTruthy();
    expect(authService.validatePasswordPolicy('123456')).toBeTruthy();
    expect(authService.validatePasswordPolicy('admin123')).toBeTruthy();
  });

  test('rejects passwords without uppercase letter', () => {
    expect(authService.validatePasswordPolicy('alllowercase1')).toBeTruthy();
  });

  test('rejects passwords without lowercase letter', () => {
    expect(authService.validatePasswordPolicy('ALLUPPERCASE1')).toBeTruthy();
  });

  test('rejects passwords without a digit', () => {
    expect(authService.validatePasswordPolicy('NoDigitsHere')).toBeTruthy();
  });
});

describe('Auth Service — Registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('registers a new user successfully', async () => {
    prisma.user.findUnique.mockResolvedValue(null); // No existing user
    prisma.user.create.mockResolvedValue({
      id: 'user-123',
      email: 'newuser@example.com',
      name: 'New User',
      role: 'CANDIDATE',
      isVerified: true,
      createdAt: new Date()
    });

    const result = await authService.register({
      email: 'newuser@example.com',
      password: 'ValidP@ss1',
      name: 'New User'
    });

    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('token', 'mock_token_abc123');
    expect(result.user.email).toBe('newuser@example.com');
  });

  test('throws 400 when email already exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing', email: 'taken@example.com' });

    await expect(authService.register({
      email: 'taken@example.com',
      password: 'ValidP@ss1',
      name: 'User'
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 400 for invalid email format', async () => {
    await expect(authService.register({
      email: 'bademail',
      password: 'ValidP@ss1',
      name: 'User'
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 400 for weak password', async () => {
    await expect(authService.register({
      email: 'user@example.com',
      password: 'password',
      name: 'User'
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  test('normalizes email to lowercase before storage', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-456',
      email: 'upper@example.com',
      name: 'Upper User',
      role: 'CANDIDATE',
      isVerified: true,
      createdAt: new Date()
    });

    await authService.register({
      email: 'UPPER@EXAMPLE.COM',
      password: 'ValidP@ss1',
      name: 'Upper User'
    });

    // Verify findUnique was called with the lowercased email
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'upper@example.com' } })
    );
  });

  test('always assigns CANDIDATE role on public registration', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-789',
      email: 'user@example.com',
      name: 'Test',
      role: 'CANDIDATE',
      isVerified: true,
      createdAt: new Date()
    });

    await authService.register({ email: 'user@example.com', password: 'ValidP@ss1', name: 'Test' });

    // Ensure create was called with CANDIDATE role
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'CANDIDATE' })
      })
    );
  });
});

describe('Auth Service — Login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('logs in with valid credentials', async () => {
    const hashedPassword = await bcrypt.hash('ValidP@ss1', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'user@example.com',
      name: 'Test User',
      role: 'CANDIDATE',
      isVerified: true,
      passwordHash: hashedPassword,
      createdAt: new Date()
    });

    const result = await authService.login({ email: 'user@example.com', password: 'ValidP@ss1' });
    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('token', 'mock_token_abc123');
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  test('throws 401 for non-existent user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(authService.login({ email: 'nobody@example.com', password: 'anything' }))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  test('throws 401 for wrong password', async () => {
    const hashedPassword = await bcrypt.hash('CorrectP@ss1', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'user@example.com',
      name: 'Test',
      role: 'CANDIDATE',
      isVerified: true,
      passwordHash: hashedPassword,
      createdAt: new Date()
    });

    await expect(authService.login({ email: 'user@example.com', password: 'WrongP@ss1' }))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  test('account is throttled after 5 failed attempts', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const email = `throttle-test-${Date.now()}@example.com`;

    // Exhaust failed attempts
    for (let i = 0; i < 5; i++) {
      try { await authService.login({ email, password: 'wrong' }); } catch {}
    }

    // 6th attempt should be throttled
    await expect(authService.login({ email, password: 'wrong' }))
      .rejects.toMatchObject({ statusCode: 429 });
  });
});

describe('Auth Service — Email Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('throws 400 when no token provided', async () => {
    await expect(authService.verifyEmail(null))
      .rejects.toMatchObject({ statusCode: 400 });
    await expect(authService.verifyEmail(undefined))
      .rejects.toMatchObject({ statusCode: 400 });
    await expect(authService.verifyEmail(''))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 400 for invalid/expired token', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(authService.verifyEmail('invalid_or_expired_token'))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('verifies email and clears token when valid', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-123',
      email: 'user@example.com',
      name: 'Test User'
    });
    prisma.user.update.mockResolvedValue({});

    const result = await authService.verifyEmail('valid_token_abc');
    expect(result).toHaveProperty('email', 'user@example.com');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isVerified: true,
          verificationToken: null,
          verificationExpires: null
        })
      })
    );
  });
});
