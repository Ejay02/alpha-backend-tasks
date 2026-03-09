# Design Notes & Decisions

## Part A — FastAPI / Python: Mini Briefing Report Generator

### Schema Design

The briefing data is normalized into four tables:

| Table | Purpose |
|-------|---------|
| `briefings` | Main record with company info, summary, recommendation, and generated HTML |
| `briefing_points` | Key points with display ordering (`position` column) |
| `briefing_risks` | Risks with display ordering |
| `briefing_metrics` | Metrics with a `UNIQUE(briefing_id, name)` constraint to enforce uniqueness |

**Rationale:** Separate tables for points, risks, and metrics enable clean relational modeling. The `position` column preserves insertion order for consistent display. Using `ON DELETE CASCADE` on all child FKs keeps cleanup simple.

### Layered Architecture

- **Schemas** (`schemas/briefing.py`): Pydantic models handle all input validation — required fields, ticker normalization (`@field_validator`), minimum counts via `Field(min_length=...)`, and unique metric names via `@model_validator`.
- **Service** (`services/briefing_service.py`): All DB operations go through a service layer, keeping routes thin.
- **Formatter** (`services/report_formatter.py`): Jinja2 environment setup with autoescaping. A `_build_report_view_model()` function transforms DB entities into template-friendly dicts (sorted points, grouped metrics, constructed title, generated timestamp).
- **Templates**: Separate `base.html` (layout + CSS) and `briefing_report.html` (content block) for clean separation.

### Tradeoffs

- Used SQLite in tests (via `StaticPool`) for speed; keeps tests DB-independent.
- `generated_html` is stored directly on the briefing row for simplicity. With more time, could use a separate table or file storage.

---

## Part B — NestJS / TypeScript: Candidate Document Intake + Summary Workflow

### Schema Design

Built on the starter's `sample_workspaces` and `sample_candidates` tables:

| Table | Purpose |
|-------|---------|
| `candidate_documents` | Document records with `candidate_id` FK, document type, file name, storage key, and raw text |
| `candidate_summaries` | Summary records tracking status (`pending` → `completed` / `failed`), LLM output fields, provider metadata, and error messages |

Both tables use `ON DELETE CASCADE` from `sample_candidates`.

### Access Control

Every endpoint resolves the candidate via `resolveCandidate(candidateId, user)` which queries with both `id` AND `workspaceId` from the auth context. If the candidate doesn't belong to the recruiter's workspace, a `404` is returned (not `403`, to avoid leaking existence info).

### Queue / Worker Design

- The starter's `QueueService` was enhanced with `registerHandler()` and automatic async processing via `setImmediate()`. This keeps job execution outside the HTTP request cycle.
- `CandidatesModule.onModuleInit()` registers the `SummaryWorker` as the handler for `generate-candidate-summary` jobs.
- The worker handles the full lifecycle: load documents → call provider → validate response → persist result or mark failed.

### Summarization Provider

- **Interface**: `SummarizationProvider` with `generateCandidateSummary(input)` returning typed `CandidateSummaryResult`.
- **Gemini provider** (`gemini-summarization.provider.ts`): Calls the Gemini 2.0 Flash REST API directly (no SDK needed), requests `application/json` response via `responseMimeType`, and validates/normalizes the parsed output.
- **Fake provider**: Returns deterministic data for tests — no network calls.
- **Conditional injection**: `LlmModule` uses a factory that checks `GEMINI_API_KEY` — Gemini when present, fake when absent.

### LLM Configuration

- **Provider**: Google Gemini 2.0 Flash (free tier via Google AI Studio)
- **Environment variable**: `GEMINI_API_KEY` — get a free key at https://aistudio.google.com/apikey
- **Structured output**: The prompt requests JSON matching `CandidateSummaryResult`. The provider validates score range (0–100), array types, non-empty summary, and valid decision values before saving.
- **Limitations**: No retry logic on transient API failures. Single prompt version (`v1`). No token usage tracking.

### Testing Strategy

All tests use `FakeSummarizationProvider` — zero network calls required. Tests cover:
- Workspace access control (cross-workspace returns 404)
- Document upload with correct candidateId
- Summary generation creates pending record + enqueues job
- Worker success path (status → completed, fields populated)
- Worker failure path (status → failed, errorMessage set)

---

## Improvements With More Time

- **NestJS Queue Persistence**: Currently, the `QueueService` is an in-memory Map. If the Node pod restarts, pending jobs are lost. The next iteration should swap this out for a real Redis-backed queue (like BullMQ).
- **Gemini Retry Logic (Exponential Backoff)**: Because Google's free tier has strict limits, the worker could implement an exponential backoff retry mechanism (e.g., retry 3 times with increasing delays) when it hits a 429 Too Many Requests error, rather than immediately marking the job as failed.
- **Database Indexes**: While our foreign keys implicitly create some indexes depending on the DB engine, explicitly adding an index on `candidateId` in the `candidate_summary` and `candidate_documents` tables would speed up the `GET /candidates/:id/summaries` endpoint at scale.
- **Python service**: Add pagination to briefing list endpoint, rate limiting, and OpenAPI schema export.
- **NestJS service**: Add file-based document storage instead of raw text in DB, pagination on summary list endpoint, and e2e tests with a test database.
- **Both**: Add Docker Compose profiles for each service, CI pipeline with test/lint steps, and structured logging. A proper UI for the frontend would be nice too.
