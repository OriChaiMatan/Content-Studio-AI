# Content Studio AI — Backend Implementation Plan

> **Status:** Planning only. No backend code has been written.
> **Frontend:** Vite + React + TypeScript MVP is complete and committed.
> **Next step:** Review and approve this plan before any implementation begins.

---

## Table of Contents

1. [Architecture Recommendation](#1-architecture-recommendation)
2. [Backend Folder Structure](#2-backend-folder-structure)
3. [API Routes](#3-api-routes)
4. [PostgreSQL + Prisma Schema](#4-postgresql--prisma-schema)
5. [Data Models](#5-data-models)
6. [PDF Upload Flow](#6-pdf-upload-flow)
7. [URL Ingestion Flow](#7-url-ingestion-flow)
8. [Manual Generation Flow](#8-manual-generation-flow)
9. [Scheduled Generation Flow](#9-scheduled-generation-flow)
10. [Environment Variables](#10-environment-variables)
11. [Security Considerations](#11-security-considerations)
12. [Implementation Phases](#12-implementation-phases)

---

## 1. Architecture Recommendation

### Why this stack

The frontend is Vite + React. It expects a REST API it can `fetch` against. The simplest and most maintainable pairing for this stage is:

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Node.js 20+ | Same language as frontend; shared TypeScript types possible |
| Framework | Express.js | Minimal, well-understood, easy to migrate to Fastify later |
| Language | TypeScript | Shares the same domain types already defined in `src/types/index.ts` |
| ORM | Prisma | Matches the database-first type design already in place |
| Database | PostgreSQL 16 | Relational model fits the domain; required for Prisma enums and JSON columns |
| Job Queue | BullMQ + Redis | Pipeline steps run as background jobs; Redis enables job retries and progress events |
| File Storage | Local disk (dev) → S3-compatible (prod) | PDF uploads need persistent storage outside the DB |
| Validation | Zod | Runtime schema validation; schemas can be shared or mirrored from frontend types |

### Topology (MVP)

```
Browser (Vite React)
    │
    │  fetch /api/*
    ▼
Express API Server  (:3001)
    │
    ├── Prisma ORM
    │       └── PostgreSQL (:5432)
    │
    ├── BullMQ Workers
    │       └── Redis (:6379)
    │
    └── Local File Storage  (./uploads/)
```

The frontend's `vite.config.ts` will proxy `/api` to `localhost:3001` in development, keeping CORS simple.

### Shared types strategy

The `src/types/index.ts` file is already designed database-first. When the backend is added, a `packages/types/` shared package (or a simple copy in `backend/src/types/`) ensures the frontend and API return identical shapes without duplication.

---

## 2. Backend Folder Structure

```
backend/
│
├── prisma/
│   ├── schema.prisma           # Full Prisma schema
│   ├── seed.ts                 # Seed script (mirrors mock data)
│   └── migrations/             # Auto-generated migration files
│
├── src/
│   ├── app.ts                  # Express app setup, middleware registration
│   ├── server.ts               # HTTP server entry point (port binding)
│   │
│   ├── api/
│   │   ├── routes/
│   │   │   ├── cases.ts        # /api/cases and /api/cases/:id
│   │   │   ├── sources.ts      # /api/cases/:id/sources
│   │   │   ├── outputs.ts      # /api/cases/:id/outputs
│   │   │   ├── pipeline.ts     # /api/cases/:id/pipeline
│   │   │   ├── library.ts      # /api/library
│   │   │   ├── settings.ts     # /api/settings
│   │   │   └── files.ts        # /api/files/upload
│   │   │
│   │   └── middleware/
│   │       ├── validate.ts     # Zod request body validation wrapper
│   │       ├── errorHandler.ts # Centralized error handler (maps to HTTP status)
│   │       ├── rateLimiter.ts  # express-rate-limit for pipeline + upload endpoints
│   │       └── notFound.ts     # 404 fallback
│   │
│   ├── services/
│   │   ├── caseService.ts      # Business logic for Content Case CRUD
│   │   ├── sourceService.ts    # Business logic for source management
│   │   ├── outputService.ts    # Approve/reject/edit/regenerate outputs
│   │   ├── pipelineService.ts  # Trigger runs, query status
│   │   ├── libraryService.ts   # Query and sync library items
│   │   └── fileService.ts      # PDF validation, storage, cleanup
│   │
│   ├── jobs/
│   │   ├── queue.ts            # BullMQ queue + connection singleton
│   │   ├── scheduler.ts        # Cron-style trigger for scheduled cases
│   │   └── workers/
│   │       ├── researchWorker.ts       # Step 1: process sources
│   │       ├── factCheckWorker.ts      # Step 2: cross-reference claims
│   │       └── contentCreationWorker.ts # Step 3: generate platform drafts
│   │
│   ├── lib/
│   │   ├── prisma.ts           # Prisma client singleton (imported everywhere)
│   │   ├── redis.ts            # Redis connection singleton
│   │   ├── storage.ts          # Abstract file storage (local dev / S3 prod)
│   │   └── urlFetcher.ts       # HTTP fetch for URL metadata/content ingestion
│   │
│   ├── schemas/
│   │   ├── caseSchemas.ts      # Zod schemas for case request bodies
│   │   ├── sourceSchemas.ts    # Zod schemas for source requests
│   │   └── outputSchemas.ts    # Zod schemas for output requests
│   │
│   └── types/
│       └── index.ts            # Copy or re-export of shared domain types
│
├── uploads/                    # Local dev file storage (gitignored)
├── .env                        # Local secrets (gitignored)
├── .env.example                # Documented template (committed)
├── package.json
└── tsconfig.json
```

---

## 3. API Routes

All routes are prefixed `/api`. The frontend's Vite dev proxy forwards `/api/*` to `localhost:3001`.

### 3.1 Content Cases

| Method | Path | Frontend action | Description |
|---|---|---|---|
| `GET` | `/api/cases` | `ContentCasesPage` load | List all cases (sorted by `updatedAt DESC`) |
| `POST` | `/api/cases` | `createCase(WizardFormData)` | Create a new case with optional initial sources |
| `GET` | `/api/cases/:id` | `getCaseById(id)` | Full case detail: includes `sources`, `outputs`, `pipeline` |
| `PATCH` | `/api/cases/:id` | `updateCase(id, partial)` | Update case settings (title, audience, schedule, etc.) |
| `DELETE` | `/api/cases/:id` | `deleteCase(id)` | Soft-delete or hard-delete case and its relations |

**`GET /api/cases` query parameters:**
- `status` — filter by `CaseStatus`
- `q` — full-text search on `title`, `industry`
- `limit` — pagination (default 50)
- `offset`

**`POST /api/cases` request body** (maps exactly to `WizardFormData`):
```json
{
  "title": "string",
  "language": "en | he",
  "targetAudience": "string",
  "industry": "string",
  "experienceLevel": "beginner | intermediate | expert",
  "writingStyle": "string",
  "goals": "string",
  "aiInstructions": "string",
  "sources": [{ "type": "text|url|pdf", "label": "string", "content": "string" }],
  "schedule": {
    "frequency": "manual | daily | weekly | monthly",
    "time": "HH:MM | null",
    "dayOfWeek": "0-6 | null",
    "dayOfMonth": "1-31 | null"
  }
}
```

**Response shape for all case endpoints** must match the frontend `ContentCase` interface exactly, including nested `sources[]`, `outputs[]`, and `pipeline[]`.

---

### 3.2 Content Sources

| Method | Path | Frontend action | Description |
|---|---|---|---|
| `POST` | `/api/cases/:id/sources` | `addSource(caseId, input)` | Add a new source to an existing case |
| `PATCH` | `/api/cases/:id/sources/:sourceId` | `updateSource(...)` | Edit label or content (text sources only) |
| `DELETE` | `/api/cases/:id/sources/:sourceId` | `deleteSource(...)` | Remove a source; sets `case.updatedAt` |

**`POST /api/cases/:id/sources` request body:**
```json
{
  "type": "text | url | pdf",
  "label": "string",
  "content": "string",
  "filePath": "string | null"
}
```

For PDF sources, `content` is the original filename and `filePath` is the server path returned by the upload endpoint (see §6). The server validates that the `filePath` belongs to a file that was recently uploaded and not yet attached to a source.

---

### 3.3 Pipeline

| Method | Path | Frontend action | Description |
|---|---|---|---|
| `GET` | `/api/cases/:id/pipeline` | Pipeline page load / polling | Returns current `PipelineStep[]` and `PipelineRun` status |
| `POST` | `/api/cases/:id/pipeline/start` | `advancePipeline(caseId)` | Creates a `PipelineRun`, enqueues jobs, sets `case.status = 'research'` |
| `GET` | `/api/cases/:id/pipeline/runs` | — (future) | List historical pipeline runs |
| `GET` | `/api/cases/:id/pipeline/runs/:runId` | — (future) | Detail for one run |

**`GET /api/cases/:id/pipeline` response:**
```json
{
  "steps": [
    {
      "id": "...",
      "name": "research | fact_check | content_creation",
      "status": "idle | running | completed | error",
      "startedAt": "ISO8601 | null",
      "completedAt": "ISO8601 | null",
      "summary": "string | null",
      "confidence": "0-100 | null"
    }
  ],
  "currentRun": {
    "id": "...",
    "status": "pending | running | completed | failed",
    "sourceCount": 5,
    "startedAt": "ISO8601",
    "completedAt": "ISO8601 | null"
  }
}
```

The frontend will poll `GET /api/cases/:id/pipeline` every 2–3 seconds while a run is active. A future enhancement would replace polling with Server-Sent Events (SSE) on this same endpoint.

**`POST /api/cases/:id/pipeline/start` guards:**
- Returns `409 Conflict` if a pipeline run is already active for this case
- Returns `400 Bad Request` if `case.status` is not `draft` or `completed`
- Rate-limited to 1 request per 10 seconds per case

---

### 3.4 Content Outputs

| Method | Path | Frontend action | Description |
|---|---|---|---|
| `PATCH` | `/api/cases/:id/outputs/:outputId` | `updateOutputBody(...)` | Edit the body text of a draft output |
| `PATCH` | `/api/cases/:id/outputs/:outputId/status` | `updateOutputStatus(...)` | Approve or reject an output |
| `POST` | `/api/cases/:id/outputs/:outputId/regenerate` | `regenerateOutput(...)` | Queue a single-output regeneration job |

**`PATCH /api/cases/:id/outputs/:outputId/status` request body:**
```json
{ "status": "approved | rejected" }
```

When status is set to `approved`, the server automatically upserts a `LibraryItem` record. This side-effect is handled server-side — the frontend does not need a separate library endpoint for this operation.

---

### 3.5 Library

| Method | Path | Frontend `libraryStore` action | Description |
|---|---|---|---|
| `GET` | `/api/library` | Page load | List library items with filter support |

**`GET /api/library` query parameters:**
- `caseId` — filter by case
- `platform` — filter by platform
- `status` — `approved | draft | rejected`
- `q` — search title and body
- `limit`, `offset`

Library items are never created directly via the API — they are a projection of approved `ContentOutput` records, maintained as a synced table by the output status endpoint.

---

### 3.6 Settings (User Profile)

| Method | Path | Frontend `settingsStore` action | Description |
|---|---|---|---|
| `GET` | `/api/settings` | `SettingsPage` load | Get the current user's profile and preferences |
| `PATCH` | `/api/settings` | `updateUser(...)`, `updateNotification(...)` | Update name, email, language, and notification flags |

**`PATCH /api/settings` request body:**
```json
{
  "name": "string",
  "email": "string",
  "language": "en | he",
  "notifications": {
    "generationComplete": true,
    "factCheckConflict": true,
    "draftReady": false
  }
}
```

---

### 3.7 File Upload

| Method | Path | Frontend `SourcesPanel` (PDF tab) | Description |
|---|---|---|---|
| `POST` | `/api/files/upload` | PDF file selection | Accepts `multipart/form-data`, stores file, returns metadata |

**Response:**
```json
{
  "fileId": "uuid",
  "fileName": "original-name.pdf",
  "fileSize": 204800,
  "mimeType": "application/pdf",
  "filePath": "/uploads/2024/03/uuid.pdf"
}
```

The `filePath` is stored temporarily. The frontend attaches it to the subsequent `POST /api/cases/:id/sources` call. Files not attached to a source within 1 hour are deleted by a cleanup job.

---

## 4. PostgreSQL + Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ── Enums ──────────────────────────────────────────────────

enum Language {
  en
  he
}

enum SourceType {
  text
  url
  pdf
}

enum Platform {
  linkedin
  facebook
  instagram
  newsletter
  podcast
  image_prompt
}

enum CaseStatus {
  draft
  research
  fact_check
  generating
  in_review
  completed
}

enum OutputStatus {
  draft
  approved
  rejected
}

enum ScheduleFrequency {
  manual
  daily
  weekly
  monthly
}

enum ExperienceLevel {
  beginner
  intermediate
  expert
}

enum PipelineStepName {
  research
  fact_check
  content_creation
}

enum PipelineStepStatus {
  idle
  running
  completed
  error
}

enum JobStatus {
  pending
  running
  completed
  failed
  cancelled
}

// ── Models ─────────────────────────────────────────────────

model User {
  id                      String      @id @default(cuid())
  name                    String
  email                   String      @unique
  role                    String      @default("Editor")
  avatarUrl               String?
  language                Language    @default(en)
  notifGenerationComplete Boolean     @default(true)
  notifFactCheckConflict  Boolean     @default(true)
  notifDraftReady         Boolean     @default(false)
  lastActiveAt            DateTime    @default(now())
  createdAt               DateTime    @default(now())
  updatedAt               DateTime    @updatedAt

  cases                   ContentCase[]

  @@map("users")
}

model ContentCase {
  id                 String            @id @default(cuid())
  userId             String
  title              String
  status             CaseStatus        @default(draft)
  language           Language          @default(en)
  targetAudience     String            @default("")
  industry           String            @default("")
  experienceLevel    ExperienceLevel   @default(intermediate)
  writingStyle       String            @default("") @db.Text
  goals              String            @default("") @db.Text
  aiInstructions     String            @default("") @db.Text

  // Schedule (denormalized — no join needed for a single case read)
  scheduleFrequency  ScheduleFrequency @default(manual)
  scheduleTime       String?           // "HH:MM"
  scheduleDayOfWeek  Int?              // 0–6
  scheduleDayOfMonth Int?              // 1–31

  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt

  user               User              @relation(fields: [userId], references: [id])
  sources            ContentSource[]
  outputs            ContentOutput[]
  pipelineSteps      PipelineStep[]    // current step state (3 rows per case)
  pipelineRuns       PipelineRun[]     // historical run log
  libraryItems       LibraryItem[]

  @@index([userId, status])
  @@index([updatedAt(sort: Desc)])
  @@map("content_cases")
}

model ContentSource {
  id            String      @id @default(cuid())
  contentCaseId String
  type          SourceType
  label         String
  content       String      @db.Text  // text body, URL, or original filename
  filePath      String?               // server path for PDFs
  fileSize      Int?                  // bytes; null for text/url
  mimeType      String?               // "application/pdf" or null
  createdAt     DateTime    @default(now())
  updatedAt     DateTime?             // null until a text source is first edited

  contentCase   ContentCase @relation(fields: [contentCaseId], references: [id], onDelete: Cascade)

  @@index([contentCaseId, createdAt(sort: Desc)])
  @@map("content_sources")
}

model ContentOutput {
  id                 String       @id @default(cuid())
  contentCaseId      String
  pipelineRunId      String?      // which run produced this output
  platform           Platform
  title              String
  body               String       @db.Text
  status             OutputStatus @default(draft)
  version            String       @default("v1.0.0")
  contentScore       Int?         // 0–100
  researchConfidence Int?         // 0–100
  factCheckAccuracy  Int?         // 0–100
  generatedAt        DateTime     @default(now())
  reviewedAt         DateTime?

  contentCase        ContentCase  @relation(fields: [contentCaseId], references: [id], onDelete: Cascade)
  pipelineRun        PipelineRun? @relation(fields: [pipelineRunId], references: [id], onDelete: SetNull)
  libraryItem        LibraryItem?

  @@index([contentCaseId, platform])
  @@index([contentCaseId, status])
  @@map("content_outputs")
}

// Represents the current state of each pipeline step for a case.
// Always 3 rows per ContentCase (one per PipelineStepName).
model PipelineStep {
  id            String             @id @default(cuid())
  contentCaseId String
  name          PipelineStepName
  status        PipelineStepStatus @default(idle)
  startedAt     DateTime?
  completedAt   DateTime?
  summary       String?            @db.Text
  confidence    Int?               // 0–100

  contentCase   ContentCase        @relation(fields: [contentCaseId], references: [id], onDelete: Cascade)

  @@unique([contentCaseId, name])
  @@map("pipeline_steps")
}

// One record per pipeline execution (manual or scheduled).
// Links to the outputs it produced.
model PipelineRun {
  id            String      @id @default(cuid())
  contentCaseId String
  triggeredBy   String      @default("manual") // "manual" | "schedule"
  status        JobStatus   @default(pending)
  sourceCount   Int         @default(0)        // snapshot of sources at run time
  startedAt     DateTime    @default(now())
  completedAt   DateTime?
  errorMessage  String?     @db.Text

  contentCase   ContentCase   @relation(fields: [contentCaseId], references: [id], onDelete: Cascade)
  outputs       ContentOutput[]
  jobs          PipelineJob[]

  @@index([contentCaseId, startedAt(sort: Desc)])
  @@map("pipeline_runs")
}

// One row per background job (Research / Fact Check / Content Creation)
// within a PipelineRun. Used for progress tracking and retry logic.
model PipelineJob {
  id            String           @id @default(cuid())
  pipelineRunId String
  stepName      PipelineStepName
  status        JobStatus        @default(pending)
  queueJobId    String?          // BullMQ job ID for status lookups
  attempts      Int              @default(0)
  maxAttempts   Int              @default(3)
  startedAt     DateTime?
  completedAt   DateTime?
  result        Json?            // step metadata / AI response summary
  errorMessage  String?          @db.Text
  createdAt     DateTime         @default(now())

  pipelineRun   PipelineRun      @relation(fields: [pipelineRunId], references: [id], onDelete: Cascade)

  @@index([pipelineRunId, stepName])
  @@map("pipeline_jobs")
}

// Approved outputs surfaced in the global Library.
// Created automatically when output.status is set to 'approved'.
model LibraryItem {
  id            String       @id @default(cuid())
  contentCaseId String
  outputId      String       @unique
  platform      Platform
  title         String
  body          String       @db.Text
  status        OutputStatus
  version       String
  date          DateTime     @default(now())

  contentCase   ContentCase  @relation(fields: [contentCaseId], references: [id])
  output        ContentOutput @relation(fields: [outputId], references: [id])

  @@index([contentCaseId])
  @@index([platform, status])
  @@map("library_items")
}
```

---

## 5. Data Models

### 5.1 ContentCase

**Table:** `content_cases`

The core entity. Every Content Case is a persistent workspace that accumulates sources over time. The `status` column reflects the current position in the workflow. The schedule columns are denormalized directly onto this table (no separate `schedules` table) because a case has exactly one schedule and the join would add no value.

**Key design decisions:**
- `userId` is present now so auth can be bolted on without a migration.
- `scheduleFrequency`, `scheduleTime`, `scheduleDayOfWeek`, `scheduleDayOfMonth` encode the `Schedule` type from `src/types/index.ts`.
- The API response serializes these four columns back into a nested `schedule: { frequency, time, dayOfWeek, dayOfMonth }` object to match the frontend type.

### 5.2 ContentSource

**Table:** `content_sources`

Sources are rows, not a JSON column. This enables full-text search, per-source metadata, and individual CRUD without loading the whole case. The `filePath` column is only populated for `type = 'pdf'`.

**Key design decisions:**
- `onDelete: Cascade` from `ContentCase` — deleting a case removes all its sources.
- `updatedAt` is a nullable `DateTime?` (not `@updatedAt`) because only text sources can be edited; URL and PDF sources are immutable after creation.
- `fileSize` and `mimeType` are stored so the UI can display file metadata without re-reading the file.

### 5.3 ContentOutput

**Table:** `content_outputs`

One row per platform per pipeline run. The `pipelineRunId` foreign key tracks which run produced each output, enabling future run-history comparisons.

**Key design decisions:**
- When `status` is updated to `approved`, the server upserts a corresponding `LibraryItem`. This is a service-layer side-effect, not a DB trigger.
- `version` follows semantic versioning (`v1.0.0`) and is bumped on regenerate.
- Score columns (`contentScore`, `researchConfidence`, `factCheckAccuracy`) are `Int?` because they will be `null` until AI integration is connected.

### 5.4 PipelineStep

**Table:** `pipeline_steps`

Three rows exist per `ContentCase` (one for each step name). They represent the **current** step state. The `@@unique([contentCaseId, name])` constraint enforces this.

When a `PipelineRun` starts, the service resets all three steps to `idle`, then advances them as jobs complete.

### 5.5 PipelineRun

**Table:** `pipeline_runs`

One row per execution of the pipeline, whether triggered manually or by the scheduler. This provides a full audit log of when content was generated and from how many sources.

**`sourceCount`** is a snapshot — it records the number of sources attached at the moment the run was triggered. This is important because sources may be added or removed between runs.

### 5.6 PipelineJob

**Table:** `pipeline_jobs`

One row per BullMQ job within a run (3 jobs per run). Stores the BullMQ job ID so the worker can be re-queried or cancelled. The `result` JSON column will eventually hold AI provider response metadata (token counts, model used, etc.).

### 5.7 LibraryItem

**Table:** `library_items`

A materialized projection of approved outputs. Maintained by the `outputService` whenever an output is approved or un-approved. The `@@unique outputId` constraint ensures one library entry per output.

The `GET /api/library` endpoint queries this table directly, applying filters server-side. The `contentCaseName` field is not stored — it is joined from `ContentCase.title` in the query and serialized into the API response.

---

## 6. PDF Upload Flow

```
1. User clicks "Add Source" → selects PDF tab → chooses a file
       │
       ▼
2. Frontend sends:
   POST /api/files/upload
   Content-Type: multipart/form-data
   Body: { file: <binary> }
       │
       ▼
3. Express + Multer middleware:
   a. Validates Content-Type is multipart/form-data
   b. Validates file.mimetype === 'application/pdf'
   c. Validates file.size <= MAX_FILE_SIZE (default 10 MB)
   d. Generates a UUID filename: {uuid}.pdf
   e. Writes to UPLOAD_DIR/{year}/{month}/{uuid}.pdf
   f. Returns 200:
      { fileId, fileName, fileSize, mimeType, filePath }
       │
       ▼
4. Frontend receives filePath, renders filename in form
       │
       ▼
5. User submits "Add Source" form
   Frontend sends:
   POST /api/cases/:id/sources
   Body: {
     type: "pdf",
     label: "Industry Report Q1",
     content: "original-name.pdf",
     filePath: "/uploads/2024/03/uuid.pdf"
   }
       │
       ▼
6. Server creates ContentSource row:
   { type: pdf, label, content (filename), filePath, fileSize, mimeType }
       │
       ▼
7. When pipeline runs (Step: Research):
   researchWorker reads filePath from ContentSource
   Calls a text-extraction service (e.g. pdf-parse) → plain text
   Adds extracted text to the research context
       │
       ▼
8. Cleanup job (runs hourly):
   Finds files in UPLOAD_DIR not referenced by any ContentSource
   and older than 1 hour → deletes them
```

**In production:** Replace local disk writes in step 3e with an S3-compatible upload (`storage.ts` abstraction). The `filePath` becomes an S3 object key. The `fileService` handles both backends behind the same interface.

---

## 7. URL Ingestion Flow

```
1. User adds a URL source:
   POST /api/cases/:id/sources
   Body: { type: "url", label: "MIT Article", content: "https://..." }
       │
       ▼
2. Server validates URL format (Zod URL schema)
   Optionally fetches Open Graph metadata:
     - page title (used to suggest a label if none provided)
     - description
     - canonical URL
   This is a lightweight HEAD/GET — not full content ingestion
       │
       ▼
3. ContentSource row is created with:
   { type: url, label, content: canonicalUrl }
   (metadata like og:title stored in label if user left it blank)
       │
       ▼
4. When pipeline runs (Step: Research):
   researchWorker reads each URL source
   Calls urlFetcher.ts → fetches page HTML
   Extracts readable content (title, body text, date)
   Feeds extracted text into the research context alongside PDF text and text notes
```

**Important constraint:** URL fetching during pipeline execution is async and can fail (site down, paywalled, robots.txt blocked). The `PipelineJob.result` JSON stores per-source fetch results so partial failures are logged without failing the whole run.

---

## 8. Manual Generation Flow

This is the primary workflow. The user clicks "Start Pipeline" on either the Dashboard, Content Cases page, or Pipeline page.

```
Frontend                      Express API                  BullMQ Workers
─────────                     ───────────                  ──────────────

POST /api/cases/:id/pipeline/start
       │
       ▼
[pipelineService.startRun]
  1. Guard: check no active run exists
  2. Create PipelineRun { triggeredBy: "manual", sourceCount: sources.length }
  3. Create 3 PipelineJob rows (pending)
  4. Reset all 3 PipelineStep rows to idle
  5. Set ContentCase.status = 'research'
  6. Enqueue BullMQ job: RESEARCH { caseId, runId }
  7. Return { run, steps }
       │
       ▼
[researchWorker receives job]
  1. Update PipelineJob { status: running, startedAt }
  2. Update PipelineStep[research] { status: running, startedAt }
  3. Load all ContentSource rows for this case
  4. For each source:
     - type=text: use content directly
     - type=url:  fetch and extract page text
     - type=pdf:  read filePath, extract text
  5. Produce researchContext (structured object)
  6. Update PipelineJob { status: completed, result: { sourceCount, themes[] } }
  7. Update PipelineStep[research] { status: completed, summary, confidence }
  8. Enqueue next job: FACT_CHECK { caseId, runId, researchContext }
  9. Set ContentCase.status = 'fact_check'
       │
       ▼
[factCheckWorker receives job]
  1. Update steps/jobs for fact_check → running
  2. Cross-references claims from researchContext
  3. Produces factCheckReport { conflicts[], verified[], confidence }
  4. Update steps/jobs for fact_check → completed
  5. Enqueue: CONTENT_CREATION { caseId, runId, researchContext, factCheckReport }
  6. Set ContentCase.status = 'generating'
       │
       ▼
[contentCreationWorker receives job]
  1. Update steps/jobs for content_creation → running
  2. For each Platform (6 total):
     Generate draft using researchContext + factCheckReport
     Create ContentOutput row { status: draft, version: v1.0.0, ... }
  3. Update steps/jobs for content_creation → completed
  4. Set ContentCase.status = 'in_review'
  5. Update PipelineRun { status: completed, completedAt }

Frontend polls GET /api/cases/:id/pipeline every 3s → receives step updates
When allDone: navigates to Review page
```

**Error handling:** If any worker job fails after `maxAttempts` retries, the `PipelineJob` and `PipelineStep` are set to `error` status. The `PipelineRun` is set to `failed` with an error message. The case status reverts to the last stable status. The user sees an error state on the Pipeline page with a retry button.

---

## 9. Scheduled Generation Flow

> **Architecture only — not to be implemented in the first backend phases.**

### Design

The scheduler is a separate process (or a long-running Express background task) that runs every 15 minutes and checks for cases due for generation.

```
Scheduler process (runs every 15 minutes)
    │
    ▼
SELECT * FROM content_cases
WHERE schedule_frequency != 'manual'
AND status NOT IN ('research', 'fact_check', 'generating')
AND (last_scheduled_run_at IS NULL OR last_scheduled_run_at < <due_threshold>)
    │
    ▼
For each due case:
    │
    ├── Compute isDue(case) based on:
    │     daily:   last run was ≥ 23 hours ago + scheduleTime has passed today
    │     weekly:  last run was ≥ 6 days ago + today == scheduleDayOfWeek + scheduleTime passed
    │     monthly: last run was ≥ 28 days ago + today == scheduleDayOfMonth + scheduleTime passed
    │
    └── If isDue:
          POST /api/cases/:id/pipeline/start { triggeredBy: "schedule" }
```

### Additional schema needed for scheduling

```sql
-- Add to content_cases table (future migration)
ALTER TABLE content_cases ADD COLUMN last_scheduled_run_at TIMESTAMPTZ;
ALTER TABLE content_cases ADD COLUMN next_scheduled_run_at TIMESTAMPTZ;
```

The `next_scheduled_run_at` column is computed and stored when:
- A case's schedule is created or updated
- A scheduled run completes successfully

This avoids recomputing the schedule on every scheduler tick.

### Delivery of scheduled notifications

When a scheduled run produces outputs, the server can notify the user via:
- In-app notification (database record read by the frontend on next load)
- Email (future: Resend or SendGrid based on `notifGenerationComplete`)

---

## 10. Environment Variables

**`backend/.env.example`**

```bash
# ── Server ───────────────────────────────────────
NODE_ENV=development
PORT=3001

# ── Database ─────────────────────────────────────
DATABASE_URL="postgresql://postgres:password@localhost:5432/content_studio_ai_dev"

# ── Redis (BullMQ) ────────────────────────────────
REDIS_URL="redis://localhost:6379"

# ── CORS ─────────────────────────────────────────
# Vite dev server origin — comma-separated for multiple
CORS_ORIGIN="http://localhost:5173"

# ── File Storage ─────────────────────────────────
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE_BYTES=10485760          # 10 MB
UPLOAD_EXPIRY_SECONDS=3600            # 1 hour cleanup window

# ── S3 (production only — leave blank in dev) ────
S3_BUCKET=""
S3_REGION=""
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
S3_ENDPOINT=""                        # for S3-compatible services (R2, MinIO)

# ── URL Fetcher ───────────────────────────────────
URL_FETCH_TIMEOUT_MS=8000
URL_FETCH_MAX_CONTENT_BYTES=2097152   # 2 MB max page content

# ── Rate Limiting ─────────────────────────────────
RATE_LIMIT_PIPELINE_WINDOW_MS=10000
RATE_LIMIT_PIPELINE_MAX=1
RATE_LIMIT_UPLOAD_WINDOW_MS=60000
RATE_LIMIT_UPLOAD_MAX=10

# ── AI Provider (not used yet — placeholder) ─────
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""

# ── Scheduler ────────────────────────────────────
SCHEDULER_ENABLED=false
SCHEDULER_INTERVAL_MINUTES=15
```

The frontend's `.env` (already exists) adds:
```bash
VITE_API_BASE_URL=http://localhost:3001
```

And `vite.config.ts` adds a proxy:
```ts
server: {
  proxy: {
    '/api': 'http://localhost:3001'
  }
}
```

---

## 11. Security Considerations

### Input validation
Every request body is validated with a Zod schema before reaching the service layer. Validation errors return `400 Bad Request` with a structured error object listing field paths and messages. This prevents garbage data from reaching the database.

### SQL injection
Prisma uses parameterized queries exclusively. No raw SQL is written unless explicitly required, and if so, it uses Prisma's `$queryRaw` with tagged template literals (which are inherently parameterized).

### File upload security
- MIME type is validated both by the HTTP header and by reading the file's magic bytes (first 4 bytes). A file named `evil.pdf` with JavaScript content is rejected.
- Files are stored with a UUID filename — original names are never used on disk.
- The `UPLOAD_DIR` path is outside the Express `static` serve path. Files are never served directly; they are read by workers only.
- File size is capped at `MAX_FILE_SIZE_BYTES` before any bytes are written to disk.

### URL fetching (SSRF prevention)
Before fetching any URL source during pipeline execution:
- Resolve the hostname to an IP address
- Reject requests to RFC-1918 private ranges (`10.x`, `172.16.x`, `192.168.x`) and loopback (`127.x`, `::1`)
- Reject requests to metadata endpoints (e.g. `169.254.169.254`)
- Enforce a short timeout (`URL_FETCH_TIMEOUT_MS`)
- Follow at most 2 redirects

### CORS
In development, `CORS_ORIGIN` is set to the Vite dev server. In production, it is set to the deployed frontend origin only. The `Access-Control-Allow-Origin` header is never set to `*`.

### Rate limiting
The pipeline start endpoint is rate-limited per IP (and later per user ID) to prevent accidental or malicious pipeline spam. The file upload endpoint is separately rate-limited to prevent storage abuse.

### Authentication (future)
Authentication is not implemented in the first phases, but every database model includes a `userId` foreign key. When auth (JWT or session-based) is added:
- A middleware reads the token, resolves the `User`, and attaches it to `req.user`
- Every service method adds `WHERE userId = req.user.id` to all queries
- No case, source, or output is accessible without ownership verification

### Headers
`helmet.js` middleware sets standard security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- CSP configured for API-only responses

---

## 12. Implementation Phases

### Phase 1 — Foundation
**Goal:** Express server starts, connects to PostgreSQL, migrations run, health check returns 200.

- [ ] Initialize `backend/` with `package.json`, `tsconfig.json`
- [ ] Install: `express`, `@prisma/client`, `prisma`, `zod`, `cors`, `helmet`, `dotenv`
- [ ] Write `prisma/schema.prisma` from the schema in §4
- [ ] Run `prisma migrate dev --name init`
- [ ] Write `src/lib/prisma.ts` singleton
- [ ] Write `src/app.ts` with health check: `GET /api/health → { status: "ok" }`
- [ ] Write `src/server.ts` entry point
- [ ] Add `vite.config.ts` proxy: `/api → localhost:3001`
- [ ] Write `prisma/seed.ts` that inserts the 5 mock cases from `mockContentCases.ts`
- **Exit criteria:** `npm run dev` starts both Vite and Express; `GET /api/health` returns 200; seed runs cleanly

---

### Phase 2 — Content Cases CRUD
**Goal:** Frontend `ContentCasesPage` and `ContentCaseDetail` load real data from the database.

- [ ] `caseService.ts`: `listCases`, `getCaseById`, `createCase`, `updateCase`, `deleteCase`
- [ ] `api/routes/cases.ts`: `GET /api/cases`, `POST /api/cases`, `GET /api/cases/:id`, `PATCH /api/cases/:id`, `DELETE /api/cases/:id`
- [ ] `schemas/caseSchemas.ts`: Zod schema matching `WizardFormData`
- [ ] `createCase` also creates 3 `PipelineStep` rows (idle) within a DB transaction
- [ ] `getCaseById` returns nested `sources`, `outputs`, `pipeline` (matching frontend `ContentCase` shape)
- [ ] API response serializes `schedule*` columns back to `{ schedule: { frequency, time, dayOfWeek, dayOfMonth } }`
- [ ] `errorHandler.ts` and `validate.ts` middleware
- [ ] Migrate `contentCasesStore.createCase` and list page to call API
- **Exit criteria:** Wizard creates a case in PostgreSQL; case list shows DB data; case detail loads correctly

---

### Phase 3 — Sources Management
**Goal:** `SourcesPanel` reads/writes sources from the database.

- [ ] `sourceService.ts`: `addSource`, `updateSource`, `deleteSource`
- [ ] `api/routes/sources.ts`: `POST`, `PATCH`, `DELETE /api/cases/:id/sources/:sourceId`
- [ ] `schemas/sourceSchemas.ts`
- [ ] `fileService.ts`: `validateFile`, `storeFile`, `deleteFile` (local disk)
- [ ] `api/routes/files.ts`: `POST /api/files/upload` with Multer
- [ ] MIME-type validation (magic bytes check)
- [ ] 1-hour orphan file cleanup job
- [ ] Migrate `SourcesPanel` to call API
- **Exit criteria:** Add/edit/delete sources persist to PostgreSQL; PDF upload stores to disk; all source operations survive page refresh

---

### Phase 4 — Pipeline (Mock Workers)
**Goal:** Pipeline page shows real job progress from the database, with simulated 3-second workers.

- [ ] `lib/redis.ts` Redis singleton
- [ ] `jobs/queue.ts` BullMQ queue setup
- [ ] `pipelineService.ts`: `startRun`, `getStatus`
- [ ] `api/routes/pipeline.ts`: `POST /api/cases/:id/pipeline/start`, `GET /api/cases/:id/pipeline`
- [ ] Rate limiter on start endpoint
- [ ] `workers/researchWorker.ts`: mock — waits 3s, updates DB, enqueues fact_check
- [ ] `workers/factCheckWorker.ts`: mock — waits 3s, updates DB, enqueues content_creation
- [ ] `workers/contentCreationWorker.ts`: mock — waits 3s, creates 6 `ContentOutput` rows, sets case status to `in_review`
- [ ] Worker error handling: retry up to 3 times, then set job/step to `error`
- [ ] Migrate `ContentCasePipeline.tsx` to poll `GET /api/cases/:id/pipeline` instead of using local `advancePipeline` timeout
- **Exit criteria:** Start pipeline → DB records update → frontend polls and reflects real step progress → outputs appear in DB → case status = `in_review`

---

### Phase 5 — Outputs and Library
**Goal:** Review page reads/writes outputs from DB; Library reads from DB.

- [ ] `outputService.ts`: `updateBody`, `updateStatus`, `regenerate`
- [ ] `libraryService.ts`: `listLibraryItems` (with filters)
- [ ] `api/routes/outputs.ts`: `PATCH /api/.../outputs/:id`, `PATCH .../status`, `POST .../regenerate`
- [ ] `api/routes/library.ts`: `GET /api/library`
- [ ] When `status = 'approved'`: `outputService` upserts a `LibraryItem` row within the same DB transaction
- [ ] When `status = 'rejected'`: `outputService` removes the `LibraryItem` if it exists
- [ ] Migrate `ContentCaseReview.tsx` to call API for approve/reject/edit/regenerate
- [ ] Migrate `LibraryPage.tsx` to load from `GET /api/library`
- **Exit criteria:** Approve output → appears in library; reject → removed; edit body persists; library filters work

---

### Phase 6 — Settings
**Goal:** Settings page reads/writes user profile from DB.

- [ ] `api/routes/settings.ts`: `GET /api/settings`, `PATCH /api/settings`
- [ ] Return the hardcoded `userId = 'user-1'` seed record until auth is added
- [ ] Migrate `SettingsPage.tsx` and `settingsStore` to call API
- **Exit criteria:** Save name/email/language/notifications → persists to DB → survives restart

---

### Phase 7 — URL Ingestion in Workers
**Goal:** URL sources are actually fetched and ingested during the Research step.

- [ ] `lib/urlFetcher.ts`: fetch page, extract readable text, SSRF guards
- [ ] Update `researchWorker.ts` to call `urlFetcher` for each URL source
- [ ] Store per-source fetch result in `PipelineJob.result`
- [ ] Graceful handling of unreachable URLs (log + continue, don't fail the run)
- **Exit criteria:** URL source content appears in research summary; failed URLs are logged but don't block the run

---

### Phase 8 — PDF Text Extraction in Workers
**Goal:** PDF sources are parsed and their text is included in the research context.

- [ ] Install and integrate `pdf-parse` (or equivalent)
- [ ] Update `researchWorker.ts` to read `filePath` and extract text for PDF sources
- [ ] Store extracted text length and page count in `PipelineJob.result`
- **Exit criteria:** PDF source text appears in research summary; large PDFs are chunked correctly

---

### Phase 9 — Scheduler Architecture (Design Review)
**Goal:** Architecture is designed, schema columns are migrated, no execution yet.

- [ ] Add `lastScheduledRunAt` and `nextScheduledRunAt` columns to `content_cases`
- [ ] Write `jobs/scheduler.ts` with the `isDue()` logic (but `SCHEDULER_ENABLED=false`)
- [ ] Document the scheduler design in a follow-up `SCHEDULER_PLAN.md`
- **Exit criteria:** Schema supports scheduling; scheduler code exists but is disabled; no breaking changes

---

### Migration note for the frontend

When each phase completes, the corresponding Zustand store action is migrated from mock data to an API call. The store remains as a **client-side cache layer** — it holds the last-fetched data so the UI doesn't re-fetch on every render. The migration pattern for each action is:

```ts
// Before (mock)
createCase: (data) => {
  const newCase = { id: genId('case'), ...data, ... };
  set(state => ({ cases: [newCase, ...state.cases] }));
  return newCase;
}

// After (API)
createCase: async (data) => {
  const res = await fetch('/api/cases', { method: 'POST', body: JSON.stringify(data) });
  const newCase = await res.json();
  set(state => ({ cases: [newCase, ...state.cases] }));
  return newCase;
}
```

This migration is incremental — each store action is switched independently, so phases can be deployed one at a time without breaking the UI.

---

*End of BACKEND_PLAN.md*
