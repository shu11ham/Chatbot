# 🚀 RAG Chatbot Deployment Guide

Complete deployment guide for the RAG-powered news chatbot with multiple deployment options.

## 📋 Prerequisites

### Required API Keys
1. **Google Gemini API Key**
   - Visit: https://aistudio.google.com/apikey
   - Create new API key
   - Copy for environment variables

2. **Jina AI Embeddings API Key**
   - Visit: https://jina.ai/embeddings
   - Sign up for free tier
   - Get API key from dashboard

### System Requirements
- **Node.js**: 18+ 
- **Docker**: 20.10+ (optional)
- **Redis**: 6+ (for caching)
- **PostgreSQL**: 13+ (optional persistence)

## 🏗️ Deployment Options

### Option 1: Local Development (Recommended for Testing)

1. **Clone and Setup**:
   ```bash
   git clone <your-repo-url>
   cd rag-chatbot
   ```

2. **Start Infrastructure**:
   ```bash
   # Start Redis, Qdrant, and PostgreSQL
   docker-compose up -d redis qdrant postgres
   ```

3. **Backend Setup**:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your API keys
   npm run setup
   npm run ingest  # This will take 5-10 minutes
   npm start
   ```

4. **Frontend Setup** (new terminal):
   ```bash
   cd frontend
   npm install
   cp .env.example .env
   # Edit .env if needed
   npm start
   ```

5. **Access Application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - Health Check: http://localhost:5000/api/health

### Option 2: Full Docker Deployment

1. **Environment Setup**:
   ```bash
   # Create backend .env
   cp backend/.env.example backend/.env
   # Edit backend/.env with your API keys
   
   # Create frontend .env
   cp frontend/.env.example frontend/.env
   ```

2. **Build and Start**:
   ```bash
   # Start infrastructure only
   docker-compose up -d
   
   # OR start everything including apps
   docker-compose --profile full-stack up -d
   ```

3. **Initialize Data**:
   ```bash
   # If using full-stack profile
   docker-compose exec backend npm run ingest
   
   # If running locally
   cd backend && npm run ingest
   ```

### Option 3: Cloud Deployment (Production)

#### Backend Deployment (Render.com)

1. **Create New Service**:
   - Connect your GitHub repo
   - Choose "Web Service"
   - Set build command: `npm install`
   - Set start command: `npm start`

2. **Environment Variables**:
   ```
   NODE_ENV=production
   PORT=5000
   GEMINI_API_KEY=your_gemini_key
   JINA_API_KEY=your_jina_key
   REDIS_URL=your_redis_url
   QDRANT_URL=your_qdrant_url
   DATABASE_URL=your_postgres_url (optional)
   ```

3. **External Services**:
   - **Redis**: Use Redis Cloud or Upstash
   - **Qdrant**: Use Qdrant Cloud or self-hosted
   - **PostgreSQL**: Use Render PostgreSQL or external

#### Frontend Deployment (Vercel)

1. **Deploy to Vercel**:
   ```bash
   cd frontend
   npm install -g vercel
   vercel
   ```

2. **Environment Variables**:
   ```
   REACT_APP_BACKEND_URL=https://your-backend-url.onrender.com
   ```

3. **Build Settings**:
   - Build Command: `npm run build`
   - Output Directory: `build`

## 🔧 Configuration

### Backend Environment Variables

```env
# Required
GEMINI_API_KEY=your_gemini_api_key_here
JINA_API_KEY=your_jina_api_key_here
REDIS_URL=redis://localhost:6379
QDRANT_URL=http://localhost:6333

# Optional
DATABASE_URL=postgresql://user:pass@localhost:5432/db
PORT=5000
NODE_ENV=development
SESSION_TTL=3600
MAX_ARTICLES=50
RSS_FEEDS=https://feeds.reuters.com/reuters/topNews,https://rss.cnn.com/rss/edition.rss
```

### Frontend Environment Variables

```env
REACT_APP_BACKEND_URL=http://localhost:5000
REACT_APP_APP_NAME=News Assistant
REACT_APP_VERSION=1.0.0
```

## 📊 Monitoring and Health Checks

### Health Endpoints
- **Backend**: `GET /api/health`
- **Detailed Health**: `GET /api/health/detailed`
- **Frontend**: `GET /health` (nginx)

### Monitoring Setup
```bash
# Check backend health
curl http://localhost:5000/api/health

# Check service status
docker-compose ps

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

## 🔍 Troubleshooting

### Common Issues

1. **Redis Connection Failed**:
   ```bash
   # Check Redis is running
   docker-compose ps redis
   # Restart Redis
   docker-compose restart redis
   ```

2. **Qdrant Not Accessible**:
   ```bash
   # Check Qdrant health
   curl http://localhost:6333/health
   # View Qdrant logs
   docker-compose logs qdrant
   ```

3. **News Ingestion Fails**:
   ```bash
   # Check API keys in .env
   # Run ingestion with debug logs
   cd backend
   DEBUG=* npm run ingest
   ```

4. **Frontend Can't Connect to Backend**:
   ```bash
   # Check REACT_APP_BACKEND_URL in frontend/.env
   # Verify backend is running on correct port
   curl http://localhost:5000/api/health
   ```

### Log Locations
- **Backend Logs**: `backend/logs/`
- **Docker Logs**: `docker-compose logs <service>`
- **Frontend Logs**: Browser console

## 🚀 Performance Optimization

### Production Settings

1. **Backend Optimizations**:
   ```env
   NODE_ENV=production
   SESSION_TTL=1800
   CHAT_HISTORY_LIMIT=100
   ```

2. **Redis Optimization**:
   ```
   maxmemory 1gb
   maxmemory-policy allkeys-lru
   ```

3. **Qdrant Optimization**:
   ```
   Enable indexing for better search performance
   Configure collection with appropriate vector size
   ```

### Scaling Considerations
- **Horizontal Scaling**: Multiple backend instances behind load balancer
- **Database**: Use connection pooling
- **Caching**: Implement response caching for common queries
- **CDN**: Use CDN for frontend static assets

## 📱 Demo Video Script

### Recording Setup (5-7 minutes)
1. **Introduction** (30s):
   - "RAG-powered chatbot for news websites"
   - Show project structure

2. **Backend Demo** (2 minutes):
   - Show health check endpoint
   - Demonstrate news ingestion process
   - Show vector database population

3. **Frontend Demo** (3 minutes):
   - Show clean, responsive interface
   - Ask sample questions about news
   - Demonstrate streaming responses
   - Show source citations
   - Test dark/light theme toggle
   - Show session management (clear chat)

4. **Technical Features** (1 minute):
   - Show real-time connection status
   - Demonstrate mobile responsiveness
   - Show session statistics in sidebar

5. **Conclusion** (30s):
   - Summarize key features
   - Show GitHub repositories

### Sample Questions for Demo
- "What's the latest news about technology?"
- "Tell me about recent climate change developments"
- "Any updates on the global economy?"
- "What are today's top political stories?"

## 📝 Submission Checklist

- [ ] Backend repository with clear README
- [ ] Frontend repository with clear README  
- [ ] Demo video (unlisted YouTube link or MP4)
- [ ] Live deployment URL
- [ ] Environment variables documented
- [ ] Code walkthrough documentation
- [ ] Tech stack justification

## 🎯 Production Readiness

### Security
- [ ] API rate limiting implemented
- [ ] Input validation and sanitization
- [ ] CORS configuration
- [ ] Environment variables secured
- [ ] HTTPS enabled in production

### Performance
- [ ] Response caching implemented
- [ ] Database connection pooling
- [ ] Frontend bundle optimization
- [ ] CDN for static assets
- [ ] Health monitoring setup

### Reliability
- [ ] Error handling and logging
- [ ] Graceful shutdown handling
- [ ] Database migrations
- [ ] Backup strategies
- [ ] Monitoring and alerting

Good luck with your deployment! 🚀