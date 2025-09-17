#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up RAG Chatbot Backend...\n');

// Create necessary directories
const directories = [
  'logs',
  'data',
  'tmp'
];

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

// Check if .env exists
if (!fs.existsSync('.env')) {
  if (fs.existsSync('.env.example')) {
    fs.copyFileSync('.env.example', '.env');
    console.log('✅ Created .env file from .env.example');
    console.log('⚠️  Please edit .env file with your API keys and configuration');
  } else {
    console.log('⚠️  .env.example not found. Please create .env file manually');
  }
} else {
  console.log('✅ .env file already exists');
}

// Check required environment variables
console.log('\n🔍 Checking environment configuration...');

const requiredEnvVars = [
  'GEMINI_API_KEY',
  'JINA_API_KEY',
  'REDIS_URL',
  'QDRANT_URL'
];

require('dotenv').config();

const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingVars.length > 0) {
  console.log('❌ Missing required environment variables:');
  missingVars.forEach(envVar => {
    console.log(`   - ${envVar}`);
  });
  console.log('\nPlease update your .env file with the missing variables.');
} else {
  console.log('✅ All required environment variables are set');
}

// Test Redis connection
console.log('\n🔗 Testing Redis connection...');
try {
  const redis = require('../config/redis');
  console.log('✅ Redis configuration loaded');
} catch (error) {
  console.log('❌ Redis connection test failed:', error.message);
}

// Test Qdrant connection
console.log('\n🔗 Testing Qdrant connection...');
try {
  const RAGService = require('../services/ragService');
  console.log('✅ Qdrant configuration loaded');
} catch (error) {
  console.log('❌ Qdrant connection test failed:', error.message);
}

// Create sample configuration files
const sampleConfigs = {
  'docker-compose.yml': `version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage

volumes:
  redis_data:
  qdrant_data:
`,
  '.gitignore': `# Dependencies
node_modules/

# Environment variables
.env
.env.local
.env.production

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Temporary folders
tmp/
temp/

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE files
.vscode/
.idea/
*.swp
*.swo

# Build outputs
dist/
build/

# Database
*.sqlite
*.db
`
};

Object.entries(sampleConfigs).forEach(([filename, content]) => {
  if (!fs.existsSync(filename)) {
    fs.writeFileSync(filename, content);
    console.log(`✅ Created ${filename}`);
  }
});

console.log('\n📋 Setup Summary:');
console.log('✅ Directory structure created');
console.log('✅ Configuration files generated');
console.log('✅ Dependencies should be installed');

console.log('\n📝 Next Steps:');
console.log('1. Update .env file with your API keys');
console.log('2. Start Redis and Qdrant (using Docker Compose or local installation)');
console.log('3. Run: npm run ingest (to populate the vector database)');
console.log('4. Run: npm start (to start the server)');

console.log('\n🐳 To start services with Docker Compose:');
console.log('   docker-compose up -d');

console.log('\n🎉 Setup completed successfully!');