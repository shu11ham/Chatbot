const express = require('express');
const redisClient = require('../config/redis');
const RAGService = require('../services/ragService');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/health - Health check endpoint
router.get('/', async (req, res) => {
  const healthCheck = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    services: {}
  };

  try {
    // Check Redis
    try {
      await redisClient.ping();
      healthCheck.services.redis = { status: 'healthy' };
    } catch (error) {
      healthCheck.services.redis = { status: 'unhealthy', error: error.message };
      healthCheck.status = 'degraded';
    }

    // Database removed - using Redis only

    // Check Qdrant
    try {
      const ragService = new RAGService();
      const stats = await ragService.getEmbeddingStats();
      healthCheck.services.qdrant = { 
        status: 'healthy', 
        documents: stats.totalDocuments 
      };
    } catch (error) {
      healthCheck.services.qdrant = { status: 'unhealthy', error: error.message };
      healthCheck.status = 'degraded';
    }

    // Check environment variables
    const requiredEnvVars = ['GEMINI_API_KEY', 'JINA_API_KEY'];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missingEnvVars.length > 0) {
      healthCheck.services.environment = { 
        status: 'unhealthy', 
        missing: missingEnvVars 
      };
      healthCheck.status = 'degraded';
    } else {
      healthCheck.services.environment = { status: 'healthy' };
    }

    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthCheck);

  } catch (error) {
    logger.error('Health check error:', error);
    res.status(503).json({
      timestamp: new Date().toISOString(),
      status: 'unhealthy',
      error: error.message
    });
  }
});

// GET /api/health/detailed - Detailed health check with performance metrics
router.get('/detailed', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const healthCheck = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {},
      performance: {}
    };

    // Test Redis performance
    const redisStartTime = Date.now();
    try {
      await redisClient.ping();
      healthCheck.services.redis = { 
        status: 'healthy',
        responseTime: Date.now() - redisStartTime
      };
    } catch (error) {
      healthCheck.services.redis = { 
        status: 'unhealthy', 
        error: error.message,
        responseTime: Date.now() - redisStartTime
      };
      healthCheck.status = 'degraded';
    }

    // Test Qdrant performance
    const qdrantStartTime = Date.now();
    try {
      const ragService = new RAGService();
      const stats = await ragService.getEmbeddingStats();
      healthCheck.services.qdrant = { 
        status: 'healthy',
        documents: stats.totalDocuments,
        vectorSize: stats.vectorSize,
        responseTime: Date.now() - qdrantStartTime
      };
    } catch (error) {
      healthCheck.services.qdrant = { 
        status: 'unhealthy', 
        error: error.message,
        responseTime: Date.now() - qdrantStartTime
      };
      healthCheck.status = 'degraded';
    }

    healthCheck.performance.totalResponseTime = Date.now() - startTime;

    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthCheck);

  } catch (error) {
    logger.error('Detailed health check error:', error);
    res.status(503).json({
      timestamp: new Date().toISOString(),
      status: 'unhealthy',
      error: error.message,
      performance: {
        totalResponseTime: Date.now() - startTime
      }
    });
  }
});

module.exports = router;