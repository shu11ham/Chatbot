#!/usr/bin/env node
const RAGService = require('../services/ragService');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

require('dotenv').config();

(async () => {
  try {
    const rag = new RAGService();
    await rag.initialize();

    const samples = [
      {
        title: 'Central Bank raises rates by 25 basis points',
        content: 'The central bank increased interest rates by 0.25% to combat inflation. Markets reacted with volatility as investors reassessed growth prospects.'
      },
      {
        title: 'Tech company unveils new AI chip',
        content: 'A leading technology firm announced a new AI accelerator chip promising 3x performance gains and improved energy efficiency for data centers.'
      },
      {
        title: 'Renewable energy hits record share of grid',
        content: 'Wind and solar reached a record share of electricity generation this quarter, driven by new capacity and favorable weather conditions.'
      }
    ];

    let totalPoints = 0;

    for (const article of samples) {
      const id = uuidv4();
      const text = `Title: ${article.title}\n\nContent: ${article.content}`;
      const embedding = await rag.generateEmbedding(text);
      await rag.storeEmbedding(`${id}_chunk_0`, text, embedding, {
        title: article.title,
        url: '',
        source: 'Sample',
        publishDate: new Date().toISOString(),
        chunkIndex: 0,
        totalChunks: 1,
        articleId: id
      });
      totalPoints += 1;
    }

    logger.info(`Seeded ${totalPoints} sample documents.`);
    console.log(`Seeded ${totalPoints} sample documents.`);
    process.exit(0);
  } catch (e) {
    console.error('Seeding failed:', e);
    process.exit(1);
  }
})();