const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const logger = require('./utils/logger');
const redisClient = require('./config/redis');
const chatRoutes = require('./routes/chat');
const sessionRoutes = require('./routes/session');
const healthRoutes = require('./routes/health');
const newsRoutes = require('./routes/news');
const RAGService = require('./services/ragService');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/news', newsRoutes);

// Socket.IO handling
io.on('connection', (socket) => {
  logger.info('User connected', { socketId: socket.id });

  socket.on('join-session', (sessionId) => {
    socket.join(sessionId);
    logger.info('User joined session', { socketId: socket.id, sessionId });
  });

  socket.on('chat-message', async (data) => {
    try {
      const { sessionId, message } = data;
      
      // Store user message
      await redisClient.lPush(`chat:${sessionId}`, JSON.stringify({
        type: 'user',
        content: message,
        timestamp: new Date().toISOString()
      }));

      // Get RAG response with streaming
      const ragService = new RAGService();
      await ragService.processQueryWithStreaming(
        message,
        sessionId,
        (chunk) => {
          io.to(sessionId).emit('chat-response-chunk', {
            sessionId,
            chunk,
            isComplete: false
          });
        },
        (finalResponse) => {
          io.to(sessionId).emit('chat-response-chunk', {
            sessionId,
            chunk: finalResponse,
            isComplete: true
          });
        }
      );

    } catch (error) {
      logger.error('Socket chat error:', error);
      socket.emit('chat-error', {
        error: 'Failed to process message',
        sessionId: data.sessionId
      });
    }
  });

  socket.on('disconnect', () => {
    logger.info('User disconnected', { socketId: socket.id });
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    redisClient.quit();
    process.exit(0);
  });
});

// Initialize and start server
async function startServer() {
  try {
    // Test Redis connection
    await redisClient.ping();
    logger.info('Redis connected successfully');

    // Initialize RAG service
    const ragService = new RAGService();
    await ragService.initialize();
    logger.info('RAG service initialized');

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info('Using Redis-only session management (PostgreSQL removed)');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();