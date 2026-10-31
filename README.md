# Industry Grade AI

Enterprise-grade, async-driven competitive programming analytics, ranking,
and AI career intelligence platform.

## Quick Start (Docker — recommended)

You only need to touch **one file**.

1. **Create your env file and add your Gemini key:**
   ```bash
   cd backend
   cp .env.example .env
   ```
   Open `backend/.env` and set:
   ```
   GEMINI_API_KEY=your_real_key_here
   ```
   Everything else (`DATABASE_URL`, `JWT_SECRET_KEY`, CORS, ports) already
   has working defaults for local Docker use. Change `JWT_SECRET_KEY`
   before deploying anywhere real, and never commit your real `.env`
   (it's already git-ignored).

2. **Start everything:**
   ```bash
   cd ..
   docker-compose up --build
   ```
   This brings up three containers:
   - `db` — Postgres 16 with the `pgvector` extension, auto-created database `ind_grade_ai`
   - `backend` — FastAPI app on **http://localhost:8000** (docs at `/docs`)
   - `frontend` — the SPA served by nginx on **http://localhost:5500**

3. **Open the app:** [http://localhost:5500](http://localhost:5500), register an
   account, and hit **Sync Now** on the dashboard.

Tables (including the `vector` extension) are created automatically on
backend startup — no manual migration step needed for local/dev use.

### (Optional) Seed sample interview data for AI Search

The RAG search tab works immediately but has nothing to retrieve until
`interview_posts` has data. To load 5 sample interview experiences
(embedded via Gemini) for testing:

```bash
docker-compose exec backend python -m scripts.seed_interview_posts
```

Re-running it is safe — it skips posts that already exist.

## Running without Docker

**Backend:**
```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # then edit DATABASE_URL to point at your own Postgres+pgvector, and set GEMINI_API_KEY
uvicorn app.main:app --reload
```
You'll need a Postgres instance with the `pgvector` extension available,
with a database named `ind_grade_ai` (the `CREATE EXTENSION IF NOT EXISTS
vector` and `CREATE TABLE` calls run automatically on startup, but the
database itself and the extension binary must exist on the server —
easiest way is the same `pgvector/pgvector:pg16` Docker image, or install
the `pgvector` extension package on your own Postgres install):
```bash
# with psql, after connecting as a superuser:
CREATE DATABASE ind_grade_ai;
```

**Frontend:**
ES modules require serving over `http://`, not opening the file directly.
Any static file server works, e.g.:
```bash
cd frontend
python -m http.server 5500
```
Then visit `http://localhost:5500`. If your backend isn't on
`localhost:8000`, update `API_BASE_URL` in `frontend/src/config.js`.

## Project Structure

See inline docstrings in each module — every file's header comment
explains its role. High-level map:

- `backend/app/core/` — config, security (JWT/bcrypt), shared constants
- `backend/app/db/` — async SQLAlchemy engine/session + declarative base
- `backend/app/models/` — one ORM model per domain (user, handles, stats, interview)
- `backend/app/schemas/` — Pydantic request/response schemas
- `backend/app/services/scrapers/` — one scraper/API client per platform, behind a shared `BaseScraper` interface
- `backend/app/services/fetcher.py` — concurrent, fault-isolated orchestrator for all 6 platforms
- `backend/app/services/scoring.py` — composite score formula
- `backend/app/services/rag_engine.py` — Gemini embeddings + pgvector search + generation
- `backend/app/api/v1/endpoints/` — the actual route handlers
- `frontend/src/services/` — fetch wrapper + one file per API domain
- `frontend/src/components/` — reusable UI pieces (navbar, modals, chart, tables, toast)
- `frontend/src/views/` — per-tab page logic (dashboard, leaderboard, settings)

## Known limitations to be aware of

- **CodeChef, GeeksforGeeks, and CodeTantra are scraped**, not queried via
  a public API — their HTML structure can change without notice. Each
  scraper fails gracefully (reported as `success: false` with an error
  message) rather than crashing the sync, but selectors in
  `app/services/scrapers/{codechef,gfg,codetantra}.py` may need updating
  over time.
- **CodeTantra requires an explicit college URL** in Settings — it's
  self-hosted per institution, so the email-prefix auto-discovery can't
  guess it.
- This uses `Base.metadata.create_all` for schema setup, which is fine for
  local/dev but not a substitute for real migrations (e.g. Alembic) in
  production.

## Fixes & Upgrades Applied

- **Gemini AI Embeddings & Generation Overhaul**:
  - Fixed retired `models/text-embedding-004` to `models/gemini-embedding-001` with explicit 768-dimension output matching Postgres pgvector `Vector(768)`.
  - Replaced legacy generation model with `models/gemini-3.1-flash-lite` and `models/gemini-3.8-flash`.
  - Configured REST transport (`transport="rest"`) to avoid gRPC connection blocks on Windows.
  - Implemented multi-tier fallback: if the free-tier API hits rate limits (429), it transparently synthesizes structured answers directly from retrieved high-relevance chunks instead of crashing with a 502 error.
  - Automatically seeded 5 real-world technical interview posts (Google, Amazon, Microsoft, Flipkart) embedded in pgvector.

- **New Backend Endpoints**:
  - `GET /api/v1/auth/me`: Fetches current authenticated user profile, active handles, and stats.
  - `GET /api/v1/sync/status`: Retrieves cached synchronization statistics immediately upon login or view switch without forcing re-scraping.
  - `GET /api/v1/sync/handles`: Returns the currently configured handles to pre-populate Settings.
  - Multi-path environment configuration: automatically discovers `.env` whether invoked from workspace root or `backend/`.
  - Allowed origin regex for local dev ports (5500, 8000, 5173, 3000, etc.) with credential support.

- **Frontend Complete Redesign**:
  - Modern Obsidian & Neon Dark theme with Google Fonts (`Plus Jakarta Sans`, `Inter`, `JetBrains Mono`).
  - Top Navigation Bar with active status, responsive mobile hamburger drawer, and live User Profile avatar pill.
  - Dashboard Redesign:
    - 4 KPI metric cards (Total Solved, Composite Score with tier classification badge, Standing & Rank, Freshness indicator).
    - 6 Dedicated Platform Cards (Codeforces, LeetCode, CodeChef, GFG, HackerRank, CodeTantra) with solved counts, ratings, and live status badges.
    - Chart.js distribution visualizer with rounded bars and theme-matched tooltips.
    - Diagnosis sync feed log.
  - Leaderboard Redesign:
    - Top 3 Podium showcase (🥇 Gold, 🥈 Silver, 🥉 Bronze) with medals, avatars, usernames, and scores.
    - Global vs Campus tabs.
    - Real-time client-side search filtering by coder username or college.
    - Current authenticated user row highlight.
  - AI Career & Interview Intel:
    - One-click prompt suggestion chips for quick testing.
    - Real-time AI response formatting with clean markdown bullet points and copy-to-clipboard button.
    - Source experience cards with similarity percentage match badges.
  - Settings Tab:
    - User account summary card.
    - Pre-populated platform inputs with judge logos and helper text.
  - Unified serving: Accessible via both `http://localhost:5500` (static) and directly via `http://localhost:8000/app`.
  values only ever live in `backend/.env`.
