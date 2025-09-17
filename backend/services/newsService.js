const axios = require('axios');
const Parser = require('rss-parser');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');
const RAGService = require('./ragService');
const logger = require('../utils/logger');

class NewsService {
  constructor() {
    this.parser = new Parser({
      customFields: {
        item: ['description', 'content', 'contentSnippet', 'pubDate', 'creator']
      }
    });
    this.ragService = new RAGService();
    
    // Default RSS feeds - can be expanded
    this.defaultFeeds = [
      'https://feeds.reuters.com/reuters/topNews',
      'https://rss.cnn.com/rss/edition.rss',
      'https://feeds.bbci.co.uk/news/rss.xml',
      'https://feeds.npr.org/1001/rss.xml',
      'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
      'https://feeds.washingtonpost.com/rss/world',
      'https://techcrunch.com/feed/',
      'https://feeds.ars-technica.com/arstechnica/index',
      'https://www.theverge.com/rss/index.xml'
    ];
    
    this.feeds = process.env.RSS_FEEDS ? 
      process.env.RSS_FEEDS.split(',').map(feed => feed.trim()) : 
      this.defaultFeeds;
    
    this.maxArticles = parseInt(process.env.MAX_ARTICLES) || 100;
    this.updateInterval = parseInt(process.env.NEWS_UPDATE_INTERVAL) || 3600000; // 1 hour default
    this.isRunning = false;
  }

  async initialize() {
    try {
      await this.ragService.initialize();
      logger.info('News service initialized');
    } catch (error) {
      logger.error('Failed to initialize news service:', error);
      throw error;
    }
  }

  /**
   * Start automatic news updates
   */
  startAutoUpdate() {
    if (this.isRunning) {
      logger.warn('News auto-update is already running');
      return;
    }

    this.isRunning = true;
    logger.info(`Starting automatic news updates every ${this.updateInterval / 1000 / 60} minutes`);
    
    // Initial fetch
    this.fetchLatestNews();
    
    // Set up periodic updates
    this.updateTimer = setInterval(() => {
      this.fetchLatestNews();
    }, this.updateInterval);
  }

  /**
   * Stop automatic news updates
   */
  stopAutoUpdate() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    this.isRunning = false;
    logger.info('Stopped automatic news updates');
  }

  /**
   * Fetch latest news from all configured RSS feeds
   */
  async fetchLatestNews() {
    try {
      logger.info('Starting news fetch from RSS feeds...');
      let totalProcessed = 0;
      let totalNew = 0;

      for (const feedUrl of this.feeds) {
        try {
          const { processed, newArticles } = await this.processFeed(feedUrl);
          totalProcessed += processed;
          totalNew += newArticles;
        } catch (error) {
          logger.warn(`Failed to process feed ${feedUrl}:`, error.message);
        }
      }

      logger.info(`News fetch completed. Processed: ${totalProcessed}, New: ${totalNew}`);
      return { totalProcessed, totalNew };
    } catch (error) {
      logger.error('Failed to fetch latest news:', error);
      throw error;
    }
  }

  /**
   * Process a single RSS feed
   */
  async processFeed(feedUrl) {
    try {
      logger.info(`Processing feed: ${feedUrl}`);
      
      const feed = await this.parser.parseURL(feedUrl);
      let processed = 0;
      let newArticles = 0;

      for (const item of feed.items.slice(0, this.maxArticles)) {
        try {
          const article = await this.processArticle(item, feed.title);
          if (article) {
            await this.storeArticle(article);
            newArticles++;
          }
          processed++;
        } catch (error) {
          logger.warn(`Failed to process article from ${feedUrl}:`, error.message);
        }
      }

      logger.info(`Feed ${feedUrl}: ${processed} processed, ${newArticles} new`);
      return { processed, newArticles };
    } catch (error) {
      logger.error(`Failed to process feed ${feedUrl}:`, error);
      throw error;
    }
  }

  /**
   * Process a single article from RSS feed
   */
  async processArticle(item, sourceName) {
    try {
      // Extract basic information
      const title = item.title || 'Untitled';
      const link = item.link || item.guid || '';
      const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
      const description = item.description || item.contentSnippet || '';
      
      // Skip if no meaningful content
      if (!title || title.length < 10) {
        return null;
      }

      // Create unique ID based on URL or title
      const articleId = link ? this.generateArticleId(link) : uuidv4();

      // Extract full content if possible
      let fullContent = description;
      try {
        if (link && this.shouldFetchFullContent(link)) {
          fullContent = await this.extractFullContent(link);
        }
      } catch (error) {
        logger.warn(`Failed to extract full content from ${link}:`, error.message);
      }

      // Clean and prepare content
      const cleanContent = this.cleanContent(fullContent || description);
      
      // Create summary
      const summary = this.createSummary(cleanContent, 300);

      return {
        id: articleId,
        title: title.trim(),
        content: cleanContent,
        summary,
        url: link,
        source: sourceName || 'Unknown',
        publishedAt: pubDate,
        processedAt: new Date(),
        metadata: {
          title,
          url: link,
          source: sourceName,
          publishedAt: pubDate.toISOString(),
          summary
        }
      };
    } catch (error) {
      logger.error('Failed to process article:', error);
      return null;
    }
  }

  /**
   * Extract full content from article URL
   */
  async extractFullContent(url) {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)'
        }
      });

      const $ = cheerio.load(response.data);
      
      // Remove unwanted elements
      $('script, style, nav, header, footer, aside, .advertisement, .ad').remove();
      
      // Try to find main content using common selectors
      const contentSelectors = [
        'article',
        '.article-body',
        '.story-body',
        '.entry-content',
        '.post-content',
        '.content',
        'main',
        '[role="main"]'
      ];

      let content = '';
      for (const selector of contentSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          content = element.text();
          break;
        }
      }

      // Fallback to body if no specific content found
      if (!content) {
        content = $('body').text();
      }

      return this.cleanContent(content);
    } catch (error) {
      logger.warn(`Failed to extract content from ${url}:`, error.message);
      return null;
    }
  }

  /**
   * Check if we should attempt to fetch full content
   */
  shouldFetchFullContent(url) {
    // Skip social media and other non-article URLs
    const skipDomains = ['twitter.com', 'facebook.com', 'instagram.com', 'youtube.com'];
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return !skipDomains.some(domain => hostname.includes(domain));
    } catch {
      return false;
    }
  }

  /**
   * Clean and normalize content text
   */
  cleanContent(text) {
    if (!text) return '';
    
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim()
      .substring(0, 5000); // Limit length
  }

  /**
   * Create a summary of the content
   */
  createSummary(content, maxLength = 300) {
    if (!content) return '';
    
    // Split into sentences
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    let summary = '';
    for (const sentence of sentences) {
      if (summary.length + sentence.length > maxLength) break;
      summary += sentence.trim() + '. ';
    }
    
    return summary.trim() || content.substring(0, maxLength) + '...';
  }

  /**
   * Generate a consistent article ID from URL
   */
  generateArticleId(url) {
    // Simple hash function to create consistent IDs
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString();
  }

  /**
   * Store article in the vector database
   */
  async storeArticle(article) {
    try {
      // Generate embedding for the article content
      const embeddingText = `${article.title} ${article.summary} ${article.content}`;
      const embedding = await this.ragService.generateEmbedding(embeddingText);
      
      // Store in vector database
      await this.ragService.storeEmbedding(
        article.id,
        embeddingText,
        embedding,
        article.metadata
      );
      
      logger.info(`Stored article: ${article.title}`);
    } catch (error) {
      logger.error(`Failed to store article ${article.title}:`, error);
      throw error;
    }
  }

  /**
   * Get news statistics
   */
  async getNewsStats() {
    try {
      const stats = await this.ragService.getEmbeddingStats();
      return {
        ...stats,
        isAutoUpdateRunning: this.isRunning,
        updateInterval: this.updateInterval,
        feedCount: this.feeds.length,
        lastUpdate: this.lastUpdateTime || null
      };
    } catch (error) {
      logger.error('Failed to get news stats:', error);
      return {
        totalDocuments: 0,
        isAutoUpdateRunning: this.isRunning,
        error: error.message
      };
    }
  }

  /**
   * Manually trigger news update
   */
  async updateNews() {
    try {
      const result = await this.fetchLatestNews();
      this.lastUpdateTime = new Date();
      return result;
    } catch (error) {
      logger.error('Manual news update failed:', error);
      throw error;
    }
  }
}

module.exports = NewsService;