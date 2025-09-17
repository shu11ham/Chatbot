const { GoogleGenerativeAI } = require('@google/generative-ai');
const { QdrantClient } = require('@qdrant/js-client-rest');
const axios = require('axios');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

class RAGService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Use memory storage if enabled
    if (process.env.USE_MEMORY_STORAGE === 'true' || !process.env.QDRANT_URL) {
      this.useMemoryStorage = true;
      this.memoryStore = new Map();
      logger.info('Using in-memory vector storage');
    } else {
      this.qdrantClient = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY
      });
      this.useMemoryStorage = false;
    }
    
    this.collectionName = process.env.QDRANT_COLLECTION_NAME || 'news_embeddings';
    this.jinaApiKey = process.env.JINA_API_KEY;
    this.embeddingDim = parseInt(process.env.EMBEDDING_DIM || '', 10) || null;
  }

  async initialize() {
    try {
      if (this.useMemoryStorage) {
        logger.info('RAG service initialized with memory storage');
      } else {
        try {
          // Determine embedding dimension if not set
          if (!this.embeddingDim) {
            const probe = await this.generateEmbedding('dimension probe');
            this.embeddingDim = Array.isArray(probe) ? probe.length : 1024;
          }

          // Check if collection exists
          const collections = await this.qdrantClient.getCollections();
          const existing = collections.collections.find(col => col.name === this.collectionName);

          if (existing) {
            // Try to fetch current vector size via count or collection info
            let currentDim = null;
            try {
              const info = await this.qdrantClient.getCollection(this.collectionName);
              currentDim = info?.result?.config?.params?.vectors?.size || null;
            } catch (_) {}

            if (currentDim && currentDim !== this.embeddingDim) {
              await this.qdrantClient.deleteCollection(this.collectionName);
              await this.createCollection(this.embeddingDim);
              logger.info('Recreated Qdrant collection with correct dimension');
            }
          } else {
            await this.createCollection(this.embeddingDim);
            logger.info('Created Qdrant collection');
          }
        } catch (qdrantError) {
          logger.warn('Qdrant not available, falling back to memory storage:', qdrantError.message);
          this.useMemoryStorage = true;
          this.memoryStore = new Map();
        }
      }

      logger.info('RAG service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize RAG service:', error);
      throw error;
    }
  }

  async createCollection(size) {
    await this.qdrantClient.createCollection(this.collectionName, {
      vectors: {
        size: size,
        distance: 'Cosine'
      }
    });
  }

  async generateEmbedding(text) {
    try {
      if (!this.jinaApiKey) throw new Error('Missing JINA_API_KEY');

      const response = await axios.post(
        'https://api.jina.ai/v1/embeddings',
        {
          input: [text],
          model: 'jina-embeddings-v2-base-en'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.jinaApiKey}`
          },
          timeout: 10000
        }
      );

      if (response.data && response.data.data && response.data.data[0]) {
        const vec = response.data.data[0].embedding;
        // Harmonize length with embeddingDim if defined
        if (this.embeddingDim && Array.isArray(vec)) {
          if (vec.length === this.embeddingDim) return vec;
          if (vec.length > this.embeddingDim) return vec.slice(0, this.embeddingDim);
          // pad with zeros
          const padded = vec.slice();
          while (padded.length < this.embeddingDim) padded.push(0);
          return padded;
        }
        // If undefined, set from API result
        if (!this.embeddingDim && Array.isArray(vec)) {
          this.embeddingDim = vec.length;
        }
        return vec;
      }
      throw new Error('Invalid embedding response');
    } catch (error) {
      logger.warn('Embedding API unavailable, using deterministic fallback embedding:', error.message);
      // Deterministic fallback embedding (bag-of-words hashing)
      const dim = this.embeddingDim || 1024;
      const vec = new Array(dim).fill(0);
      const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      for (const t of tokens) {
        let h = 2166136261;
        for (let i = 0; i < t.length; i++) {
          h ^= t.charCodeAt(i);
          h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
        }
        const idx = Math.abs(h) % dim;
        vec[idx] += 1;
      }
      // Normalize
      const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
      return vec.map(v => v / norm);
    }
  }

  async storeEmbedding(id, text, embedding, metadata = {}) {
    try {
      // Ensure Qdrant-compatible point ID: unsigned integer or UUID
      const isUuid = (s) => typeof s === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(s);
      const toPointId = (raw) => {
        if (typeof raw === 'number' && raw >= 0) return raw;
        if (isUuid(raw)) return raw;
        // Fallback to numeric id
        return Math.abs(Number(BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000))));
      };
      const pointId = toPointId(id);

      if (this.useMemoryStorage) {
        if (!this.memoryStore) this.memoryStore = new Map();
        this.memoryStore.set(pointId, { id: pointId, text, vector: embedding, metadata });
        return;
      }

      await this.qdrantClient.upsert(this.collectionName, {
        wait: true,
        points: [{
          id: pointId,
          vector: embedding,
          payload: {
            text,
            ...metadata
          }
        }]
      });
    } catch (error) {
      logger.error('Failed to store embedding:', error);
      throw error;
    }
  }

  async searchSimilar(queryEmbedding, topK = 5) {
    try {
      if (this.useMemoryStorage) {
        if (!this.memoryStore || this.memoryStore.size === 0) {
          logger.info('Memory storage search - no documents available yet');
          return [];
        }
        const cosine = (a, b) => {
          let dot = 0, na = 0, nb = 0;
          for (let i = 0; i < a.length; i++) {
            const av = a[i] || 0;
            const bv = b[i] || 0;
            dot += av * bv; na += av * av; nb += bv * bv;
          }
          const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
          return dot / denom;
        };
        const scored = [];
        for (const { id, text, vector, metadata } of this.memoryStore.values()) {
          const score = cosine(queryEmbedding, vector);
          scored.push({ id, text, score, metadata });
        }
        scored.sort((x, y) => y.score - x.score);
        return scored.slice(0, topK);
      }

      const searchResult = await this.qdrantClient.search(this.collectionName, {
        vector: queryEmbedding,
        limit: topK,
        with_payload: true
      });

      return searchResult.map(result => ({
        text: result.payload.text,
        score: result.score,
        metadata: result.payload
      }));
    } catch (error) {
      logger.error('Failed to search similar documents:', error);
      throw error;
    }
  }

  async processQuery(query, sessionId) {
    try {
      let context = '';
      let similarDocs = [];

      if (this.useMemoryStorage) {
        // For memory storage without documents, use general knowledge
        context = 'No specific news articles available in memory storage.';
        logger.info('Processing query with general knowledge (no documents)');
      } else {
        // Generate embedding for query
        const queryEmbedding = await this.generateEmbedding(query);

        // Search for similar documents
        similarDocs = await this.searchSimilar(queryEmbedding, 5);

        // Create context from retrieved documents
        context = similarDocs
          .map(doc => doc.text)
          .join('\n\n');
      }

      // Generate response using Gemini with fallback
      let response;
      try {
        const prompt = this.useMemoryStorage ? 
          this.createGeneralPrompt(query) : 
          this.createPrompt(query, context);
        const result = await this.model.generateContent(prompt);
        response = result.response.text();
      } catch (error) {
        if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('API_KEY_INVALID') || error.message.includes('expired') || error.message.includes('overloaded') || error.message.includes('503')) {
          // Fallback response when API quota is exceeded or key is invalid/expired or service overloaded
          response = this.createFallbackResponse(query, similarDocs);
          logger.warn('Using fallback response due to API issues:', error.message);
        } else {
          throw error;
        }
      }

      // Store assistant response in Redis
      await redisClient.lPush(`chat:${sessionId}`, JSON.stringify({
        type: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
        sources: similarDocs.map(doc => ({
          title: doc.metadata.title || 'News Article',
          url: doc.metadata.url || '',
          score: doc.score
        }))
      }));

      return {
        response,
        sources: similarDocs.map(doc => ({
          title: doc.metadata.title || 'News Article',
          url: doc.metadata.url || '',
          score: doc.score
        }))
      };
    } catch (error) {
      logger.error('Failed to process query:', error);
      throw error;
    }
  }

  async processQueryWithStreaming(query, sessionId, onChunk, onComplete) {
    try {
      let context = '';
      let similarDocs = [];

      if (this.useMemoryStorage) {
        // For memory storage without documents, use general knowledge
        context = 'No specific news articles available in memory storage.';
        logger.info('Processing streaming query with general knowledge (no documents)');
      } else {
        // Generate embedding for query
        const queryEmbedding = await this.generateEmbedding(query);

        // Search for similar documents
        similarDocs = await this.searchSimilar(queryEmbedding, 5);

        // Create context from retrieved documents
        context = similarDocs
          .map(doc => doc.text)
          .join('\n\n');
      }

      // Generate response using Gemini with streaming and fallback
      let fullResponse = '';
      try {
        const prompt = this.useMemoryStorage ? 
          this.createGeneralPrompt(query) : 
          this.createPrompt(query, context);
        const result = await this.model.generateContentStream(prompt);
        
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          fullResponse += chunkText;
          onChunk(chunkText);
        }
      } catch (error) {
        if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('API_KEY_INVALID') || error.message.includes('expired') || error.message.includes('overloaded') || error.message.includes('503')) {
          // Fallback response when API quota is exceeded or key is invalid/expired or service overloaded
          fullResponse = this.createFallbackResponse(query, similarDocs);
          logger.warn('Using fallback response for streaming due to API issues:', error.message);
          onChunk(fullResponse);
        } else {
          throw error;
        }
      }

      // Store complete assistant response in Redis
      await redisClient.lPush(`chat:${sessionId}`, JSON.stringify({
        type: 'assistant',
        content: fullResponse,
        timestamp: new Date().toISOString(),
        sources: similarDocs.map(doc => ({
          title: doc.metadata.title || 'News Article',
          url: doc.metadata.url || '',
          score: doc.score
        }))
      }));

      onComplete({
        response: fullResponse,
        sources: similarDocs.map(doc => ({
          title: doc.metadata.title || 'News Article',
          url: doc.metadata.url || '',
          score: doc.score
        }))
      });

    } catch (error) {
      logger.error('Failed to process streaming query:', error);
      throw error;
    }
  }

  createPrompt(query, context) {
    return `You are a helpful news assistant. Answer the user's question based on the provided news context. 
If the context doesn't contain enough information to answer the question, say so politely.

Context from recent news articles:
${context}

User Question: ${query}

Please provide a comprehensive answer based on the news context above. If you reference specific information, try to be specific about which news source or event you're referring to.

Answer:`;
  }

  createGeneralPrompt(query) {
    return `You are a friendly and knowledgeable AI assistant. The user is asking: "${query}"

Please provide a helpful, informative, and engaging response. Be conversational, clear, and comprehensive. If the question is about recent news or current events, politely explain that you don't have access to real-time news data, but offer to provide general information about the topic or suggest reliable news sources.

Guidelines:
- Be friendly and conversational
- Provide detailed, helpful answers
- Use examples when appropriate
- If unsure, ask clarifying questions
- Keep responses well-structured and easy to read

Answer:`;
  }

  async getChatHistory(sessionId, limit = 50) {
    try {
      const messages = await redisClient.lRange(`chat:${sessionId}`, 0, limit - 1);
      return messages.map(msg => JSON.parse(msg)).reverse();
    } catch (error) {
      logger.error('Failed to get chat history:', error);
      throw error;
    }
  }

  async clearChatHistory(sessionId) {
    try {
      await redisClient.del(`chat:${sessionId}`);
      logger.info('Chat history cleared', { sessionId });
    } catch (error) {
      logger.error('Failed to clear chat history:', error);
      throw error;
    }
  }

  async getEmbeddingStats() {
    try {
      if (this.useMemoryStorage) {
        return {
          totalDocuments: this.memoryStore ? this.memoryStore.size : 0,
          vectorSize: 1024,
          indexedDocuments: this.memoryStore ? this.memoryStore.size : 0
        };
      }
      // Try count API for robust stats
      const countRes = await this.qdrantClient.count(this.collectionName, { exact: true });
      return {
        totalDocuments: (countRes && countRes.count) || (countRes?.result?.count) || 0,
        vectorSize: 1024,
        indexedDocuments: (countRes && countRes.count) || (countRes?.result?.count) || 0
      };
    } catch (error) {
      logger.error('Failed to get embedding stats:', error);
      return { totalDocuments: 0, vectorSize: 1024, indexedDocuments: 0 };
    }
  }

  /**
   * Create a fallback response when API quota is exceeded
   */
  createFallbackResponse(query, similarDocs = []) {
    let response = "I apologize, but I'm currently experiencing API limitations. However, I can provide you with some relevant information based on the news articles I have:\n\n";
    
    if (similarDocs.length > 0) {
      response += "Here are some relevant news articles I found:\n\n";
      similarDocs.slice(0, 3).forEach((doc, index) => {
        // Handle both payload (from Qdrant) and metadata (from search results) structures
        const metadata = doc.payload || doc.metadata || {};
        const title = metadata.title || 'News Article';
        const summary = metadata.summary || '';
        const url = metadata.url || '';
        const source = metadata.source || '';
        
        response += `${index + 1}. **${title}**\n`;
        if (summary) {
          response += `   ${summary.substring(0, 200)}${summary.length > 200 ? '...' : ''}\n`;
        }
        if (source) {
          response += `   Source: ${source}\n`;
        }
        if (url && url !== '') {
          response += `   Read more: ${url}\n`;
        }
        response += `   Relevance: ${Math.round((doc.score || 0) * 100)}%\n\n`;
      });
      
      response += `Based on these ${similarDocs.length} relevant articles, I can help answer questions about recent technology developments, news trends, and current events. Please try asking more specific questions about the topics mentioned above.`;
    } else {
      response += "Unfortunately, I couldn't find specific articles matching your query at the moment. Please try rephrasing your question or ask about general news topics like:\n";
      response += "- Technology developments\n";
      response += "- Business news\n";
      response += "- Current events\n";
      response += "- Breaking news\n";
    }
    
    return response;
  }
}

module.exports = RAGService;