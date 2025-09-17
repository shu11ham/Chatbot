const express = require('express');
const { v4: uuidv4 } = require('uuid');
const RAGService = require('../services/ragService');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

const router = express.Router();

// POST /api/session/create - Create a new session
router.post('/create', async (req, res) => {
  try {
    const sessionId = uuidv4();
    
    // Store session metadata in Redis
    await redisClient.hSet(`session:${sessionId}`, {
      created: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    });
    
    // Set TTL for session (1 hour by default)
    const sessionTTL = parseInt(process.env.SESSION_TTL) || 3600;
    await redisClient.expire(`session:${sessionId}`, sessionTTL);

    res.json({
      sessionId,
      message: 'Session created successfully'
    });
  } catch (error) {
    logger.error('Session creation error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// GET /api/session/:sessionId/history - Get chat history for a session
router.get('/:sessionId/history', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const ragService = new RAGService();
    const messages = await ragService.getChatHistory(sessionId, limit);

    // Update last activity
    await redisClient.hSet(`session:${sessionId}`, 'lastActivity', new Date().toISOString());

    res.json({
      sessionId,
      messages,
      count: messages.length
    });
  } catch (error) {
    logger.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get chat history' });
  }
});

// DELETE /api/session/:sessionId/clear - Clear chat history for a session
router.delete('/:sessionId/clear', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const ragService = new RAGService();
    await ragService.clearChatHistory(sessionId);

    // Update last activity
    await redisClient.hSet(`session:${sessionId}`, 'lastActivity', new Date().toISOString());

    res.json({
      sessionId,
      message: 'Chat history cleared successfully'
    });
  } catch (error) {
    logger.error('Clear history error:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

// GET /api/session/stats - Get session statistics
router.get('/stats', async (req, res) => {
  try {
    const ragService = new RAGService();
    
    // Get session count from Redis
    const sessionKeys = await redisClient.keys('session:*');
    const sessionCount = sessionKeys.length;
    
    // Get chat history count
    const chatKeys = await redisClient.keys('chat:*');
    let totalMessages = 0;
    for (const key of chatKeys) {
      const messageCount = await redisClient.lLen(key);
      totalMessages += messageCount;
    }
    
    const embeddingStats = await ragService.getEmbeddingStats();

    res.json({
      sessions: {
        totalSessions: sessionCount,
        totalMessages: totalMessages
      },
      embeddings: embeddingStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

module.exports = router;