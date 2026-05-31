# Backend Engineering Assessment? 🙂‍↔️

This repository contains two independent backend services for the take-home assessment:

- **`python-service/`** (InsightOps): FastAPI + SQLAlchemy — Mini Briefing Report Generator
- **`ts-service/`** (TalentFlow): NestJS + TypeORM — Candidate Document Intake + Summary Workflow

## Prerequisites

- Docker
- Python 3.12
- Node.js 22+
- npm

## Quick Start

### 1. Start PostgreSQL

```bash
# Run this command from the root of the repository
docker compose up -d postgres
```

This starts PostgreSQL on `localhost:5432` with database `assessment_db`, user `assessment_user`, password `assessment_pass`.

---

### 2. Python Service (InsightOps)

```bash
cd python-service
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

**Run migrations:**
```bash
python -m app.db.run_migrations up
```

**Run service:**
```bash
python -m uvicorn app.main:app --reload --port 8000
```

**Run tests:**
```bash
python -m pytest -v
```

#### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/briefings` | Create a briefing |
| `GET` | `/briefings/{id}` | Retrieve a briefing |
| `POST` | `/briefings/{id}/generate` | Generate HTML report |
| `GET` | `/briefings/{id}/html` | Fetch rendered HTML |

---

### 3. TypeScript Service (TalentFlow)

```bash
cd ts-service
npm install
cp .env.example .env
```

**Configure LLM (optional):** Add your Gemini API key to `.env`:
```
GEMINI_API_KEY=your_key_here
```
Get a free key at [Google AI Studio](https://aistudio.google.com/apikey). Without a key, the service uses a fake provider (suitable for testing).

**Run migrations:**
```bash
npm run migration:run
```

**Run service (runs on http://localhost:3000):**
```bash
npm run start:dev
```

**Run tests:**
```bash
npm test
```

#### API Endpoints

All candidate endpoints require auth headers: `x-user-id` and `x-workspace-id`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/sample/candidates` | Create initial candidate. Body: `{"fullName": "...", "email": "..."}` |
| `POST` | `/candidates/:candidateId/documents` | Upload a candidate document |
| `POST` | `/candidates/:candidateId/summaries/generate` | Request async summary generation |
| `GET` | `/candidates/:candidateId/summaries` | List summaries for a candidate |
| `GET` | `/candidates/:candidateId/summaries/:summaryId` | Retrieve a single summary |

**Note:** You must create a candidate first via `POST /sample/candidates` to get a `candidateId` for the other endpoints.

---

## Design Decisions & Notes

See [NOTES.md](NOTES.md) for detailed design decisions, schema rationale, and tradeoffs.