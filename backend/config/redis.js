const { createClient } = require('redis');
const logger = require('../utils/logger');

// In-memory storage fallback
class MemoryStorage {
  constructor() {
    this.data = new Map();
    this.hashes = new Map();
    this.expirations = new Map();
  }

  async ping() {
    return 'PONG';
  }

  async set(key, value, options = {}) {
    this.data.set(key, value);
    if (options.EX) {
      setTimeout(() => this.data.delete(key), options.EX * 1000);
    }
    return 'OK';
  }

  async get(key) {
    return this.data.get(key) || null;
  }

  async lpush(key, ...values) {
    const list = this.data.get(key) || [];
    list.unshift(...values);
    this.data.set(key, list);
    return list.length;
  }

  async lrange(key, start, stop) {
    const list = this.data.get(key) || [];
    return list.slice(start, stop === -1 ? undefined : stop + 1);
  }

  async llen(key) {
    const list = this.data.get(key) || [];
    return list.length;
  }

  async hset(key, field, value) {
    if (typeof field === 'object') {
      // Multiple fields
      if (!this.hashes.has(key)) {
        this.hashes.set(key, new Map());
      }
      const hash = this.hashes.get(key);
      Object.entries(field).forEach(([k, v]) => {
        hash.set(k, v);
      });
      return Object.keys(field).length;
    } else {
      // Single field
      if (!this.hashes.has(key)) {
        this.hashes.set(key, new Map());
      }
      this.hashes.get(key).set(field, value);
      return 1;
    }
  }

  async hget(key, field) {
    if (!this.hashes.has(key)) {
      return null;
    }
    return this.hashes.get(key).get(field) || null;
  }

  async keys(pattern) {
    const allKeys = [
      ...this.data.keys(),
      ...this.hashes.keys()
    ];
    
    if (pattern === '*') {
      return allKeys;
    }
    
    // Simple pattern matching (only supports prefix*)
    const prefix = pattern.replace('*', '');
    return allKeys.filter(key => key.startsWith(prefix));
  }

  async expire(key, seconds) {
    setTimeout(() => {
      this.data.delete(key);
      this.hashes.delete(key);
    }, seconds * 1000);
    return 1;
  }

  async del(key) {
    const deleted = this.data.delete(key) || this.hashes.delete(key);
    return deleted ? 1 : 0;
  }

  async quit() {
    this.data.clear();
    this.hashes.clear();
    this.expirations.clear();
    return 'OK';
  }
}

let redisClient;

if (process.env.USE_MEMORY_STORAGE === 'true' || !process.env.REDIS_URL) {
  logger.info('Using in-memory storage instead of Redis');
  redisClient = new MemoryStorage();
} else {
  redisClient = createClient({
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD || undefined,
    database: parseInt(process.env.REDIS_DB) || 0,
    retry_delay_on_failover: 100,
    max_attempts: 3
  });

  redisClient.on('error', (err) => {
    logger.error('Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    logger.info('Redis client connected');
  });

  redisClient.on('ready', () => {
    logger.info('Redis client ready');
  });

  redisClient.on('end', () => {
    logger.info('Redis client disconnected');
  });

  // Connect to Redis
  (async () => {
    try {
      await redisClient.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      logger.info('Falling back to in-memory storage');
      redisClient = new MemoryStorage();
    }
  })();
}

module.exports = redisClient;