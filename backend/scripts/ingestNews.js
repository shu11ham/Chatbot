const Parser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');
const RAGService = require('../services/ragService');
const logger = require('../utils/logger');
require('dotenv').config();

class NewsIngestionService {
  constructor() {
    this.parser = new Parser({
      customFields: {
        item: ['description', 'content', 'contentSnippet']
      }
    });
    this.ragService = new RAGService();
    this.maxArticles = parseInt(process.env.MAX_ARTICLES) || 50;
    this.rssFeeds = process.env.RSS_FEEDS ? 
      process.env.RSS_FEEDS.split(',') : [
        'https://feeds.reuters.com/reuters/topNews',
        'https://rss.cnn.com/rss/edition.rss',
        'https://feeds.bbci.co.uk/news/rss.xml',
        'https://feeds.npr.org/1001/rss.xml'
      ];
  }

  async initialize() {
    await this.ragService.initialize();
    logger.info('News ingestion service initialized');
  }

  async fetchArticleContent(url) {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)'
        }
      });

      const $ = cheerio.load(response.data);
      
      // Remove unwanted elements
      $('script, style, nav, header, footer, aside, .advertisement, .ads').remove();
      
      // Try to find main content
      let content = '';
      const contentSelectors = [
        'article',
        '[role="main"]',
        '.content',
        '.article-body',
        '.story-body',
        '.post-content',
        'main',
        '#content'
      ];

      for (const selector of contentSelectors) {
        const element = $(selector);
        if (element.length && element.text().trim().length > 200) {
          content = element.text().trim();
          break;
        }
      }

      // Fallback to body if no content found
      if (!content) {
        content = $('body').text().trim();
      }

      // Clean up whitespace
      content = content.replace(/\s+/g, ' ').trim();
      
      return content.length > 100 ? content.substring(0, 5000) : null;
    } catch (error) {
      logger.warn(`Failed to fetch article content from ${url}:`, error.message);
      return null;
    }
  }

  async processFeed(feedUrl) {
    try {
      logger.info(`Processing RSS feed: ${feedUrl}`);
      const feed = await this.parser.parseURL(feedUrl);
      
      const articles = [];
      const maxPerFeed = Math.ceil(this.maxArticles / this.rssFeeds.length);

      for (let i = 0; i < Math.min(feed.items.length, maxPerFeed); i++) {
        const item = feed.items[i];
        
        // Get article content
        let content = item.contentSnippet || item.description || '';
        
        // Try to fetch full article if content is short
        if (content.length < 200 && item.link) {
          const fullContent = await this.fetchArticleContent(item.link);
          if (fullContent) {
            content = fullContent;
          }
        }

        if (content && content.length > 50) {
          articles.push({
            id: uuidv4(),
            title: item.title || 'Untitled',
            content: content,
            url: item.link || '',
            publishDate: item.pubDate || new Date().toISOString(),
            source: feed.title || 'Unknown',
            feedUrl: feedUrl
          });
        }
      }

      logger.info(`Processed ${articles.length} articles from ${feedUrl}`);
      return articles;
    } catch (error) {
      logger.error(`Failed to process feed ${feedUrl}:`, error);
      return [];
    }
  }

  chunkText(text, maxChunkSize = 1000, overlap = 100) {
    const chunks = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    let i = 0;

    while (i < sentences.length) {
      const sentence = sentences[i].trim();
      
      if (currentChunk.length + sentence.length + 1 <= maxChunkSize) {
        currentChunk += (currentChunk ? '. ' : '') + sentence;
        i++;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk + '.');
          
          // Create overlap
          const words = currentChunk.split(' ');
          const overlapWords = words.slice(-Math.floor(overlap / 10));
          currentChunk = overlapWords.join(' ');
        } else {
          // Handle very long sentences
          chunks.push(sentence + '.');
          currentChunk = '';
          i++;
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk + '.');
    }

    return chunks;
  }

  async ingestArticles() {
    try {
      logger.info('Starting news ingestion process...');
      
      const allArticles = [];
      
      // Process all RSS feeds
      for (const feedUrl of this.rssFeeds) {
        const articles = await this.processFeed(feedUrl);
        allArticles.push(...articles);
      }

      logger.info(`Total articles collected: ${allArticles.length}`);

      // Process and store articles
      let processedCount = 0;
      
      for (const article of allArticles) {
        try {
          // Chunk the article content
          const chunks = this.chunkText(article.content);
          
          for (let i = 0; i < chunks.length; i++) {
            const chunkId = `${article.id}_chunk_${i}`;
            const chunkText = `Title: ${article.title}\n\nContent: ${chunks[i]}`;
            
            // Generate embedding
            const embedding = await this.ragService.generateEmbedding(chunkText);
            
            // Store in vector database
            await this.ragService.storeEmbedding(chunkId, chunkText, embedding, {
              title: article.title,
              url: article.url,
              source: article.source,
              publishDate: article.publishDate,
              chunkIndex: i,
              totalChunks: chunks.length,
              articleId: article.id
            });
          }

          processedCount++;
          
          if (processedCount % 5 === 0) {
            logger.info(`Processed ${processedCount}/${allArticles.length} articles`);
          }
          
          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          logger.error(`Failed to process article ${article.title}:`, error);
        }
      }

      logger.info(`News ingestion completed. Processed ${processedCount} articles.`);
      
      // Get final stats
      const stats = await this.ragService.getEmbeddingStats();
      logger.info('Vector database stats:', stats);
      
      return {
        articlesProcessed: processedCount,
        totalEmbeddings: stats.totalDocuments,
        sources: [...new Set(allArticles.map(a => a.source))]
      };

    } catch (error) {
      logger.error('News ingestion failed:', error);
      throw error;
    }
  }
}

// CLI execution
if (require.main === module) {
  (async () => {
    try {
      const ingestionService = new NewsIngestionService();
      await ingestionService.initialize();
      const result = await ingestionService.ingestArticles();
      
      console.log('\n✅ News ingestion completed successfully!');
      console.log(`📰 Articles processed: ${result.articlesProcessed}`);
      console.log(`🔍 Total embeddings: ${result.totalEmbeddings}`);
      console.log(`📡 Sources: ${result.sources.join(', ')}`);
      
      process.exit(0);
    } catch (error) {
      console.error('❌ News ingestion failed:', error);
      process.exit(1);
    }
  })();
}

module.exports = NewsIngestionService;