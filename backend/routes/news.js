const express = require('express');
const NewsService = require('../services/newsService');
const logger = require('../utils/logger');

const router = express.Router();
let newsService = null;

// Initialize news service
async function initializeNewsService() {
  if (!newsService) {
    newsService = new NewsService();
    await newsService.initialize();
    
    // Start auto-update if enabled
    if (process.env.AUTO_UPDATE_NEWS === 'true') {
      newsService.startAutoUpdate();
    }
  }
  return newsService;
}

// GET /api/news/stats - Get news statistics
router.get('/stats', async (req, res) => {
  try {
    const service = await initializeNewsService();
    const stats = await service.getNewsStats();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get news stats:', error);
    res.status(500).json({ 
      error: 'Failed to get news statistics',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/news/update - Manually trigger news update
router.post('/update', async (req, res) => {
  try {
    const service = await initializeNewsService();
    const result = await service.updateNews();
    
    res.json({
      success: true,
      message: 'News update completed',
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Manual news update failed:', error);
    res.status(500).json({ 
      error: 'Failed to update news',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/news/start-auto-update - Start automatic updates
router.post('/start-auto-update', async (req, res) => {
  try {
    const service = await initializeNewsService();
    service.startAutoUpdate();
    
    res.json({
      success: true,
      message: 'Automatic news updates started',
      interval: service.updateInterval
    });
  } catch (error) {
    logger.error('Failed to start auto-update:', error);
    res.status(500).json({ 
      error: 'Failed to start automatic updates',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/news/stop-auto-update - Stop automatic updates
router.post('/stop-auto-update', async (req, res) => {
  try {
    const service = await initializeNewsService();
    service.stopAutoUpdate();
    
    res.json({
      success: true,
      message: 'Automatic news updates stopped'
    });
  } catch (error) {
    logger.error('Failed to stop auto-update:', error);
    res.status(500).json({ 
      error: 'Failed to stop automatic updates',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/news/feeds - Get configured RSS feeds
router.get('/feeds', async (req, res) => {
  try {
    const service = await initializeNewsService();
    
    res.json({
      feeds: service.feeds,
      count: service.feeds.length,
      maxArticles: service.maxArticles,
      updateInterval: service.updateInterval
    });
  } catch (error) {
    logger.error('Failed to get feeds:', error);
    res.status(500).json({ 
      error: 'Failed to get feeds information',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;