const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const prisma = require('../config/db');
const { generateToken } = require('../config/jwt');
const { sendVerificationEmail } = require('../config/mailer');

const WEAK_PASSWORDS = new Set([
  '123456', '12345678', '123456789', 'password', 'password123',
  'qwerty', 'qwerty123', 'admin123', 'codearena', 'letmein123', 'welcome123'
]);

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// In-memory failed attempt tracking (email -> { count, lockedUntil })
const failedLoginAttempts = new Map();

function validatePasswordPolicy(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (WEAK_PASSWORDS.has(password.toLowerCase())) {
    return 'Password is too common and easily guessed. Please choose a stronger password.';
  }
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);

  if (!hasUpper || !hasLower || !hasDigit) {
    return 'Password must contain at least one uppercase letter, one lowercase letter, and one number.';
  }
  return null;
}

function validateEmailFormat(email) {
  if (!email || !EMAIL_REGEX.test(email)) {
    return 'Please provide a valid email address (e.g. user@example.com).';
  }
  return null;
}

function checkLoginThrottle(email) {
  const record = failedLoginAttempts.get(email);
  if (record && record.lockedUntil) {
    if (record.lockedUntil > Date.now()) {
      const minutesLeft = Math.ceil((record.lockedUntil - Date.now()) / (60 * 1000));
      const error = new Error(`Too many failed login attempts. Account temporarily throttled. Please try again in ${minutesLeft} minute(s).`);
      error.statusCode = 429;
      error.isOperational = true;
      throw error;
    } else {
      // Cooldown expired
      failedLoginAttempts.delete(email);
    }
  }
}

function recordLoginFailure(email) {
  const now = Date.now();
  const record = failedLoginAttempts.get(email) || { count: 0, lockedUntil: null };
  record.count += 1;
  if (record.count >= 5) {
    record.lockedUntil = now + 15 * 60 * 1000; // 15 min lockout
  }
  failedLoginAttempts.set(email, record);
}

function recordLoginSuccess(email) {
  failedLoginAttempts.delete(email);
}

async function register({ email, password, name }) {
  const emailErr = validateEmailFormat(email);
  if (emailErr) {
    const error = new Error(emailErr);
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  const passErr = validatePasswordPolicy(password);
  if (passErr) {
    const error = new Error(passErr);
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) {
    const error = new Error('An account with this email address already exists.');
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Public registration is strictly restricted to CANDIDATE
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: name.trim(),
      passwordHash,
      role: 'CANDIDATE',
      isVerified: true, // Auto-verified for seamless local DX while logging link
      verificationToken,
      verificationExpires
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isVerified: true,
      createdAt: true
    }
  });

  // Dispatch verification email / log link
  await sendVerificationEmail(normalizedEmail, verificationToken);

  const token = generateToken({ userId: user.id, role: user.role });
  return { user, token };
}

async function login({ email, password }) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  checkLoginThrottle(normalizedEmail);

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    recordLoginFailure(normalizedEmail);
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    error.isOperational = true;
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    recordLoginFailure(normalizedEmail);
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    error.isOperational = true;
    throw error;
  }

  // Login successful
  recordLoginSuccess(normalizedEmail);

  const token = generateToken({ userId: user.id, role: user.role });
  const safeUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: user.createdAt
  };

  return { user: safeUser, token };
}

async function verifyEmail(token) {
  if (!token) {
    const error = new Error('Verification token is required.');
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  const user = await prisma.user.findFirst({
    where: {
      verificationToken: token,
      verificationExpires: { gte: new Date() }
    }
  });

  if (!user) {
    const error = new Error('Invalid or expired verification token.');
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isVerified: true,
      verificationToken: null,
      verificationExpires: null
    }
  });

  return { email: user.email, name: user.name };
}

module.exports = {
  register,
  login,
  verifyEmail,
  validatePasswordPolicy,
  validateEmailFormat
};
