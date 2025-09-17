# Demo Script / Video Checklist

Use this checklist to record a clean end-to-end demo.

## 1) Start Dependencies
- Start Redis (if not running): `brew services start redis`
- Start Docker runtime (Colima or Docker Desktop): `colima start` (if needed)
- Start Qdrant: `docker run -d --name qdrant -p 6333:6333 -p 6334:6334 qdrant/qdrant:latest`

## 2) Configure Backend
- In `backend/.env`:
  - `PORT=5001`
  - `USE_MEMORY_STORAGE=false`
  - `REDIS_URL=redis://localhost:6379`
  - `QDRANT_URL=http://localhost:6333`
  - Set API keys if available (`GEMINI_API_KEY`, `JINA_API_KEY`) or rely on fallback embedding

## 3) Run Backend
- `cd backend`
- `npm start`
- Verify health: `curl http://localhost:5001/api/health`
  - Expect: redis healthy, qdrant healthy

## 4) Seed/Ingst Data
- Option A: Real ingestion (requires internet): `npm run ingest`
- Option B: Seed sample data (offline-ready): `node scripts/seedSample.js`

## 5) Chat Test
- Create session: `curl -s -X POST http://localhost:5001/api/session/create`
- Ask a question: `curl -s -X POST http://localhost:5001/api/chat/message -H 'Content-Type: application/json' -d '{"message":"What did the central bank announce?","sessionId":"<SESSION_ID>"}'`
- Expect: meaningful answer and sources from seeded docs

## 6) Frontend
- `cd frontend && npm install`
- `npm start`
- Open http://localhost:3000 (React dev server)
- Chat, reset session, view messages

## 7) Stats & Maintenance
- Stats: `curl -s http://localhost:5001/api/session/stats`
- Clear session: `curl -X DELETE http://localhost:5001/api/session/<SESSION_ID>/clear`

## 8) Docker Compose Persistence (optional)
- Use root `docker-compose.yml` to start `redis` and `qdrant` with volumes
- `docker compose up -d redis qdrant`

## Notes
- Fallback embedding implemented for offline demo
- PostgreSQL removed; Redis-only session management
