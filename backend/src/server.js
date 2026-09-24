const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const http = require('node:http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');

const authRoutes = require('./routes/authRoutes');
const interviewRoutes = require('./routes/interviewRoutes');
const questionRoutes = require('./routes/questionRoutes');
const codeRoutes = require('./routes/codeRoutes');
const evaluationRoutes = require('./routes/evaluationRoutes');
const replayRoutes = require('./routes/replayRoutes');
const errorHandler = require('./middlewares/errorHandler');
const { initSocket } = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || true,
    credentials: true
  }
});
initSocket(io);

// Security Headers (relaxed CSP for Monaco Editor from CDN)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true
  })
);

// Body parsers & Cookie parser
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static Frontend Delivery
const frontendPath = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    platform: 'CodeArena',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// REST API Routes
app.use('/api/auth', authRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/code', codeRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/replay', replayRoutes);

// Fallback for HTML5 client-side navigation
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  // If specific view requested or route matches, serve corresponding html
  if (req.path === '/login') return res.sendFile(path.join(frontendPath, 'views/login.html'));
  if (req.path === '/register') return res.sendFile(path.join(frontendPath, 'views/register.html'));
  if (req.path === '/dashboard') return res.sendFile(path.join(frontendPath, 'views/dashboard.html'));
  if (req.path === '/interview') return res.sendFile(path.join(frontendPath, 'views/interview.html'));
  if (req.path === '/replay') return res.sendFile(path.join(frontendPath, 'views/replay.html'));
  if (req.path === '/problems') return res.sendFile(path.join(frontendPath, 'views/problems.html'));

  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Centralized Operational Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 CodeArena Server listening on http://localhost:${PORT}`);
  console.log(`📡 Socket.IO Real-Time Gateway initialized`);
  console.log(`📁 Static Frontend served from: ${frontendPath}`);
  console.log(`=======================================================`);
});

module.exports = { app, server };
