# RAG Chatbot Backend

A Node.js Express server implementing a Retrieval-Augmented Generation (RAG) pipeline for news-based chatbot functionality.

## Features

- 🔍 **RAG Pipeline**: Jina embeddings + Qdrant vector database + Google Gemini Pro
- 📰 **News Ingestion**: Automated RSS feed processing and article extraction
- 💬 **Real-time Chat**: Socket.IO for streaming responses
- 🔄 **Session Management**: Redis caching with optional PostgreSQL persistence
- 📊 **Health Monitoring**: Comprehensive system health checks
- 🚀 **Streaming Responses**: Server-sent events and WebSocket support

## Quick Start

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Setup**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

3. **Initialize Services**:
   ```bash
   # Start Redis and Qdrant (using Docker Compose)
   docker-compose up -d
   
   # Setup database and directories
   npm run setup
   ```

4. **Ingest News Data**:
   ```bash
   npm run ingest
   ```

5. **Start Server**:
   ```bash
   npm start        # Production
   npm run dev      # Development with nodemon
   ```

## Environment Variables

### Required
- `GEMINI_API_KEY`: Google Gemini Pro API key
- `JINA_API_KEY`: Jina AI embeddings API key
- `REDIS_URL`: Redis connection URL
- `QDRANT_URL`: Qdrant vector database URL

### Optional
- `DATABASE_URL`: PostgreSQL connection (for persistence)
- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Environment mode
- `SESSION_TTL`: Session timeout in seconds
- `MAX_ARTICLES`: Maximum articles to ingest

## API Endpoints

### Chat
- `POST /api/chat/message` - Send chat message
- `POST /api/chat/stream` - Send message with streaming response

### Session Management
- `POST /api/session/create` - Create new session
- `GET /api/session/:id/history` - Get chat history
- `DELETE /api/session/:id/clear` - Clear chat history
- `GET /api/session/stats` - Get session statistics

### Health & Monitoring
- `GET /api/health` - Basic health check
- `GET /api/health/detailed` - Detailed system health

## Architecture

### RAG Pipeline
1. **News Ingestion**: RSS feeds → Article extraction → Text chunking
2. **Embedding Generation**: Jina AI embeddings for semantic search
3. **Vector Storage**: Qdrant for similarity search
4. **Query Processing**: User query → Similar chunks → Context formation
5. **Response Generation**: Gemini Pro with retrieved context

### Caching Strategy
- **Redis**: Session data, chat history (TTL: 1 hour)
- **PostgreSQL**: Optional persistent storage for chat transcripts
- **Memory**: Temporary processing data

### Performance Features
- Connection pooling for database
- Rate limiting for API calls
- Streaming responses for better UX
- Health checks for monitoring

## Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with hot reload
- `npm run setup` - Initialize project (directories, configs)
- `npm run ingest` - Ingest news articles into vector database
- `npm test` - Run tests

## Docker Compose Services

```yaml
services:
  redis:    # Session storage
  qdrant:   # Vector database
  postgres: # Optional persistence
```

## Deployment

### Local Development
```bash
docker-compose up -d  # Start services
npm run setup         # Initialize
npm run ingest        # Populate data
npm run dev          # Start development server
```

### Production
- Use environment variables for configuration
- Set up proper logging and monitoring
- Configure reverse proxy (nginx)
- Set up SSL/TLS certificates

## Monitoring

### Health Checks
- Redis connectivity
- Qdrant vector database status
- PostgreSQL connection (if enabled)
- Environment variable validation

### Logging
- Winston logger with structured logging
- Request/response logging
- Error tracking with stack traces
- Performance metrics

## Contributing

1. Follow the existing code structure
2. Add tests for new features
3. Update documentation
4. Use ESLint for code formatting

## License

MIT License - see LICENSE file for details