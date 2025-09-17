const express = require('express');
const { v4: uuidv4 } = require('uuid');
const RAGService = require('../services/ragService');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

const router = express.Router();

// POST /api/chat/message - Send a chat message
router.post('/message', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const finalSessionId = sessionId || uuidv4();

    // Store user message in Redis
    await redisClient.lPush(`chat:${finalSessionId}`, JSON.stringify({
      type: 'user',
      content: message,
      timestamp: new Date().toISOString()
    }));

    // Process query with RAG
    const ragService = new RAGService();
    const result = await ragService.processQuery(message, finalSessionId);

    res.json({
      sessionId: finalSessionId,
      response: result.response,
      sources: result.sources,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Chat message error:', error);
    res.status(500).json({ 
      error: 'Failed to process message',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/chat/stream - Send a chat message with streaming response
router.post('/stream', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const finalSessionId = sessionId || uuidv4();

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Store user message in Redis
    await redisClient.lPush(`chat:${finalSessionId}`, JSON.stringify({
      type: 'user',
      content: message,
      timestamp: new Date().toISOString()
    }));

    // Send initial session info
    res.write(`data: ${JSON.stringify({ 
      type: 'session', 
      sessionId: finalSessionId 
    })}\n\n`);

    const ragService = new RAGService();
    
    let fullResponse = '';
    let sources = [];

    await ragService.processQueryWithStreaming(
      message,
      finalSessionId,
      (chunk) => {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ 
          type: 'chunk', 
          content: chunk 
        })}\n\n`);
      },
      (result) => {
        sources = result.sources;
        res.write(`data: ${JSON.stringify({ 
          type: 'complete', 
          sources: result.sources 
        })}\n\n`);
        res.end();
      }
    );

    // Response is already stored in Redis by RAGService

  } catch (error) {
    logger.error('Chat stream error:', error);
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      error: 'Failed to process message' 
    })}\n\n`);
    res.end();
  }
});

module.exports = router;