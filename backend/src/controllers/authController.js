const authService = require('../services/authService');
const { COOKIE_OPTIONS } = require('../config/jwt');
const { z } = require('zod');

// Schema definitions
const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address').transform(val => val.toLowerCase().trim()),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z.string().min(2, 'Name must be at least 2 characters long').transform(val => val.trim()),
  role: z.any().optional() // Public role is overridden to CANDIDATE
});

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address').transform(val => val.toLowerCase().trim()),
  password: z.string().min(1, 'Password is required')
});

async function register(req, res, next) {
  try {
    const validatedData = registerSchema.parse(req.body);

    // Reject attempt to register as ADMIN publicly
    if (req.body && req.body.role === 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Administrator accounts cannot be registered publicly.'
      });
    }

    const { user, token } = await authService.register(validatedData);

    res.cookie('token', token, COOKIE_OPTIONS);

    res.status(201).json({
      success: true,
      message: 'Account registered successfully. Welcome to CodeArena!',
      data: { user, token }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors.map(e => e.message).join(', ')
      });
    }
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { user, token } = await authService.login(validatedData);

    res.cookie('token', token, COOKIE_OPTIONS);

    res.json({
      success: true,
      message: 'Logged in successfully',
      data: { user, token }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors.map(e => e.message).join(', ')
      });
    }
    next(error);
  }
}

async function logout(req, res) {
  res.clearCookie('token', COOKIE_OPTIONS);
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}

async function me(req, res) {
  res.json({
    success: true,
    data: { user: req.user }
  });
}

async function verifyEmail(req, res, next) {
  try {
    const token = req.query.token || req.body.token;
    const result = await authService.verifyEmail(token);
    res.json({
      success: true,
      message: 'Email verified successfully. You can now use all platform features.',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  logout,
  me,
  verifyEmail
};
