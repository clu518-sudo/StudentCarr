# Job Discovery — Implementation Plan

A RAG-based job recommendation feature for the Jobs page (`http://localhost:10003/jobs`).

---

## Architecture overview

```
Frontend (:10003)  ── POST /api/job-discovery/recommend ──▶  Backend (:10001)
                                                                       │
                                                                       ▼
                                              AIServices (:10002, LangGraph)
                                                  ├── /job-discovery/recommend
                                                  ├── /job-discovery/ingest          (placeholder — admin-only, not exposed in UI)
                                                  └── /job-discovery/ingest-crawled  (placeholder for crawl4AI)
                                                                       │
                                                                       ▼
                                                       Chroma (Docker :8000)
                                                       collection: job_positions
                                                       embeddings: text-embedding-3-small

CLI (scripts/)  ── node seed-jobs.mjs <file.json> ──▶  AIServices /job-discovery/ingest
                                                       (developer / admin tool to populate Chroma with mock data)
```

**LangGraph nodes:** `summarizeProfile` → `retrieveJobs` (Chroma k=10) → `rankAndExplain` *(placeholder pass-through)* → `finalize` (top 8).

---

## Locked decisions

- **Job source:** mock JSON seeded via CLI for MVP. Upload HTTP route exists as an **admin-only placeholder** (not wired to the UI). Placeholder route reserved for a future **crawl4AI → Chroma** pipeline.
- **No end-user write access to Chroma.** Users only consume recommendations; ingestion is an admin/developer concern.
- **Chroma:** Docker container on `:8000`, managed by `docker-compose.yml` at the project root. Data **bind-mounted** to `./chroma-data/` on the host (gitignored) so the vector DB survives container recreation and is visible in Explorer for inspection/backup.
- **Embeddings:** OpenAI `text-embedding-3-small` via existing `OPENAI_API_KEY` / `DASHSCOPE_API_KEY`.
- **Re-ranking:** node skeleton only — pass-through now, swap in an LLM re-rank later without touching graph topology.
- **Routing:** one Jobs page, internal view state (`idle | loading | list | detail`) — no upload view, no new react-router routes.

---

## Phase 1 — Infrastructure & dependencies

- [x] **1.1** Create `docker-compose.yml` at project root with service `chroma` (image `chromadb/chroma:latest`, port `8000:8000`, bind mount `./chroma-data:/chroma/chroma`, env `IS_PERSISTENT=TRUE`, `restart: unless-stopped`). *Done in this session.*
- [x] **1.2** Add `chroma-data/` to `.gitignore` so the local vector DB files are never committed. *Done in this session.*
- [x] **1.3** *(Optional)* Pin the Chroma image to a specific version instead of `:latest` to avoid silent upgrades. Check current tag at https://hub.docker.com/r/chromadb/chroma/tags. -> version as 1.5.9.
- [x] **1.4** Start the container: `docker compose up -d` (auto-pulls the image on first run; subsequent runs start instantly). have to start docker desktop to run image.
- [x] **1.5** Install AIServices dependencies:
  ```bash
  cd AIServices
  npm install chromadb @langchain/community
  ```
- [x] **1.6** Add `CHROMA_URL=http://127.0.0.1:8000` to `AIServices/.env` (and `.env.example` if present).
- [x] **1.7** Verify Chroma is reachable: `curl http://127.0.0.1:8000/api/v2/heartbeat` returns a nanosecond timestamp. use browser to check.
- [x] **1.8** Verify persistence: `docker compose down`, confirm `./chroma-data/` still has files, then `docker compose up -d` and confirm the same data is visible.

---

## Phase 2 — AIServices: schema, Chroma client, ingestion

Create directory `AIServices/src/job-discovery/`.

### 2.1 Schemas — `AIServices/src/job-discovery/schema.ts`
- [x] **2.1.1** Define `jobPositionSchema` (Zod) with the **role-profile field set from Appendix A.2** (per the "Schema change required" note in A.1): `id` (UUID — validated with `z.uuid()`), `roleName`, `category`, `overview`, `coreSkills: string[]`, `commonTools: string[]`, `typicalResponsibilities: string[]`, `typicalEducation`, `entryLevelExperience`, `seniorityLevels: string[]`, `typicalSalaryRange`, `commonIndustries: string[]`, `careerPaths: string[]`, `relatedRoles: string[]`, `learningResources: string[]`. (Name kept as `jobPositionSchema` so 2.1.2 / 2.1.4 and Phase 2–5 references stay valid — only the *shape* changed.)
- [x] **2.1.2** Define `jobPositionUploadSchema` = `{ positions: jobPositionSchema[] }`.
- [x] **2.1.3** Define `recommendRequestSchema` = `{ userProfile: manualProfileSchema }` (import `manualProfileSchema` from `generate_user_infomation.ts` or re-export it).
- [x] **2.1.4** Define `recommendedJobSchema` = `{ position, matchScore, matchReasons: string[], gaps: string[] }` and `recommendResponseSchema` = `{ summary, jobs: recommendedJobSchema[] }`.
- [x] **2.1.5** Export TypeScript types via `z.infer<...>`.

### 2.2 Chroma client — `AIServices/src/job-discovery/chroma.ts`
- [x] **2.2.1** Build a singleton `OpenAIEmbeddings` configured with `text-embedding-3-small` and the existing API key / base URL.
- [x] **2.2.2** Build a singleton `Chroma` vectorstore from `@langchain/community/vectorstores/chroma` bound to collection `job_positions` and URL `process.env.CHROMA_URL`.
- [x] **2.2.3** Export `getJobsVectorStore()` returning the singleton.

### 2.3 Ingestion logic — `AIServices/src/job-discovery/ingest.ts`
- [x] **2.3.1** `buildPageContent(position)` joins `title + company + description + requirements + skills` into one string.
- [x] **2.3.2** `ingestJobPositions(positions)`:
  - Validate each with `jobPositionSchema`.
  - Build `Document[]` with `pageContent` from 2.3.1 and `metadata = position` (the full structured object, so we can return it without a DB).
  - Upsert into Chroma keyed by `position.id` (delete-then-add or use `addDocuments({ ids })`).
  - Return `{ inserted, skipped, errors }`.

### 2.4 LangGraph workflow — `AIServices/src/job-discovery/graph.ts`
- [ ] **2.4.1** `GraphState` annotation: `userProfile`, `jobMarketSummary`, `retrievedJobs`, `rankedJobs`.
- [ ] **2.4.2** Node `summarizeProfile` — LLM call (reuse `buildModel()` pattern from `generate_user_infomation.ts`) that compresses the profile into a compact job-market query string (target roles, skills, seniority, location, must-haves).
- [ ] **2.4.3** Node `retrieveJobs` — `vectorStore.similaritySearchWithScore(summary, 10)`. Map results into `{ position, similarityScore }[]`. (`position` comes from `doc.metadata`.)
- [ ] **2.4.4** Node `rankAndExplain` *(placeholder)* — pass-through: map each retrieved job to `{ position, matchScore: round(similarityScore * 100), matchReasons: [], gaps: [] }`. Leave a `// TODO` comment explaining that this becomes an LLM call later.
- [ ] **2.4.5** Node `finalize` — sort by `matchScore` desc, slice to 8, return as `rankedJobs`.
- [ ] **2.4.6** Wire edges `START → summarizeProfile → retrieveJobs → rankAndExplain → finalize → END`. Compile.
- [ ] **2.4.7** Export `recommendJobs({ userProfile })` returning `{ summary, jobs }`.

### 2.5 HTTP routes — extend `AIServices/src/server.ts`
- [ ] **2.5.1** `POST /job-discovery/ingest` *(placeholder — admin/CLI use only)* — parse body via `jobPositionUploadSchema`, call `ingestJobPositions`, return result. Add a comment block: "Not exposed to end users; consumed by the CLI seed script and reserved for a future admin UI."
- [ ] **2.5.2** `POST /job-discovery/ingest-crawled` — same handler body as 2.5.1, but with a comment block marking it as the crawl4AI ingestion endpoint placeholder.
- [ ] **2.5.3** `POST /job-discovery/recommend` — parse body via `recommendRequestSchema`, call `recommendJobs`, return `{ success, data }`.
- [ ] **2.5.4** Match the existing error-handling shape (Zod 400, service errors 500) used by `handleProfileGeneration`.

---

## Phase 3 — CLI seeding tool (mock data into Chroma)

**Build this BEFORE the backend bridge / frontend** — it's the fastest path to a populated Chroma collection we can develop against, and it doubles as the admin-only ingestion path until a proper admin UI exists.

### 3.1 Mock data file
- [ ] **3.1.1** Create `scripts/mock-data/job-postings.sample.json` with 15–20 realistic mock postings covering a spread of roles, locations, and skill stacks (so retrieval results look meaningful during dev). Conform to `jobPositionSchema` from 2.1.

### 3.2 Seed script — `scripts/seed-jobs.mjs`
- [ ] **3.2.1** Node ESM script (no TS compile step) with a CLI signature:
  ```
  node scripts/seed-jobs.mjs <path-to-postings.json> [--url http://127.0.0.1:10002] [--reset]
  ```
- [ ] **3.2.2** Read + parse the JSON file. Validate it's a `{ positions: [...] }` shape or a bare array — accept both, normalize internally.
- [ ] **3.2.3** `POST` the payload to `${AI_SERVICES_URL}/job-discovery/ingest`. Print a compact per-position result and a final `{ inserted, skipped, errors }` summary.
- [ ] **3.2.4** Non-zero exit code on any error (so the script is CI/automation-friendly).
- [ ] **3.2.5** `--reset` flag *(optional, can defer to 3.4)*: call a new `DELETE /job-discovery/collection` endpoint that drops + recreates the `job_positions` collection. Useful for re-seeding during dev.

### 3.3 npm script
- [ ] **3.3.1** Add to the root `package.json` (or `AIServices/package.json` — whichever is the natural entry point):
  ```json
  "scripts": {
    "seed:jobs": "node scripts/seed-jobs.mjs scripts/mock-data/job-postings.sample.json"
  }
  ```
- [ ] **3.3.2** Document the command in the file's top-of-script comment block: prerequisites (Chroma up, AIServices up), how to provide a custom file, how to reset.

### 3.4 *(Optional)* Reset endpoint — `AIServices/src/server.ts`
- [ ] **3.4.1** `DELETE /job-discovery/collection` — drops the `job_positions` collection and recreates it empty. Guard with a comment block: "Admin/CLI only; not exposed via Backend."

---

## Phase 4 — Backend bridge

Create directory `Backend/src/jobDiscovery/` following the `processTracking` pattern.

**Scope note:** Backend exposes **only** the recommend route to the frontend. The upload route stays in AIServices and is reached directly by the CLI seed script — Backend does **not** proxy it, since end users must not be able to write to Chroma.

### 4.1 Service — `jd.service.js`
- [ ] **4.1.1** `recommendJobs(userId)` — load the user's profile via existing `profileManagement` service, `fetch` to `http://127.0.0.1:10002/job-discovery/recommend`, return the response data.
- [ ] **4.1.2** Use a configurable AIServices base URL (`process.env.AI_SERVICES_URL || 'http://127.0.0.1:10002'`).

### 4.2 Controller — `jd.controller.js`
- [ ] **4.2.1** `recommend(req, res, next)` — call `recommendJobs(req.user.id)`, respond `{ success, data }`.
- [ ] **4.2.2** Reuse the `formatZodError` helper pattern from `pt.controller.js` for any input validation errors.

### 4.3 Routes — `jd.routes.js`
- [ ] **4.3.1** `POST /recommend` → `requireAuth` + `recommend`.
- [ ] **4.3.2** *(No upload route.)* Leave a one-line comment in this file: "Ingestion is admin-only and lives in AIServices; CLI seeds via `scripts/seed-jobs.mjs`."

### 4.4 Wire into router — `Backend/src/routes/index.js`
- [ ] **4.4.1** `router.use("/job-discovery", jobDiscoveryRoutes);`
- [ ] **4.4.2** Export an `index.js` in `jobDiscovery/` so the import mirrors `processTracking`.

---

## Phase 5 — Frontend

### 5.1 API client
- [ ] **5.1.1** Add a single function in the existing `App/src/lib/` (the file used by `processTracking`/`profileManagement`):
  - `recommendJobs()` → `POST /api/job-discovery/recommend`.
  - *(No `uploadJobPostings` — users cannot ingest.)*

### 5.2 Rewrite `App/src/components/jobs/JobsView.jsx`
Replace the placeholder with a single component with internal state:

```js
{ view: 'idle' | 'loading' | 'list' | 'detail',
  jobs: [...], selectedJobId, error }
```

- [ ] **5.2.1 — Idle view:** header + primary "Find matching jobs" button. **No upload affordance.**
- [ ] **5.2.2 — Loading view:** spinner + status text.
- [ ] **5.2.3 — List view:** responsive grid of job cards. Each card shows `title`, `company`, `location`, `matchScore` badge, short snippet. Card `onClick` → `setView('detail')` and `setSelectedJobId(job.position.id)`.
- [ ] **5.2.4 — Detail view:** full posting (`description`, `requirements[]`, `responsibilities[]`, `skills[]`, salary, `applyUrl`, future `matchReasons`/`gaps` lists). "← Back to results" button → `setView('list')`.
- [ ] **5.2.5** Disable the "Find matching jobs" button with a hint if the user's profile is empty.
- [ ] **5.2.6 — Empty-result state:** if the recommend call returns zero jobs, show a friendly empty state ("No matching jobs yet — check back later") instead of an empty grid. (The most likely cause during dev is an unseeded Chroma; admin runs `npm run seed:jobs`.)

---

## Phase 6 — End-to-end test

- [ ] **6.1** Start Chroma from the project root: `docker compose up -d` (writes data to `./chroma-data/`).
- [ ] **6.2** Start all services: `start-all-services.bat`.
- [ ] **6.3** **Seed Chroma** (admin/dev step): `npm run seed:jobs` → confirm `{ inserted: N }` printed and exit code 0.
- [ ] **6.4** Log in to the app at `http://localhost:10003`.
- [ ] **6.5** Go to **Jobs** (`/jobs`) → idle view shows "Find matching jobs", **no upload control visible**.
- [ ] **6.6** Click **Find matching jobs** → loading view appears → results grid renders.
- [ ] **6.7** Click a card → detail view shows full posting + requirements.
- [ ] **6.8** Click **← Back to results** → returns to list with state preserved.
- [ ] **6.9** Refresh the page → confirm idle view (re-running is intentional until Phase 7.2).
- [ ] **6.10** Confirm `/api/job-discovery/upload-postings` is **not** mounted on Backend (404 expected).

---

## Phase 7 — Post-MVP follow-ups (not blocking ship)

- [ ] **7.1** Build an **admin UI** for `POST /job-discovery/ingest` (gated by role check). Until then, the CLI seed script is the only ingestion path.
- [ ] **7.2** Persist recommendation runs in Prisma (new model `JobRecommendationRun`) so refresh restores last results.
- [ ] **7.3** Implement the LLM re-rank inside `rankAndExplain`: structured-output LLM call that scores each top-N posting and emits `matchReasons[]` + `gaps[]`. Graph topology stays unchanged.
- [ ] **7.4** SSE-stream LangGraph progress (reuse `onProgress` callback pattern from `generate_user_infomation.ts`) so the loading view shows real node-by-node status.
- [ ] **7.5** Build the **crawl4AI → Chroma** ingestion service (separate Python process) that POSTs to `/job-discovery/ingest-crawled`. Defer until the seeded flow is validated.
- [ ] **7.6** Cache the profile-summary embedding keyed by profile `updatedAt` to avoid re-embedding on every click.
- [ ] **7.7** Pagination / "show more" beyond the top 8.

---

## File checklist (what should exist when done)

```
AIServices/
  src/
    job-discovery/
      schema.ts
      chroma.ts
      ingest.ts
      graph.ts
    server.ts                        (extended with 3 routes + optional reset)

Backend/
  src/
    jobDiscovery/
      index.js
      jd.routes.js                   (recommend only — no upload route)
      jd.controller.js
      jd.service.js
    routes/index.js                  (extended with /job-discovery mount)

App/
  src/
    components/jobs/JobsView.jsx     (rewritten — no upload UI)
    lib/<existing api client>.js     (extended with `recommendJobs` only)

scripts/
  seed-jobs.mjs                      (CLI: POST mock data → AIServices /ingest)
  mock-data/
    job-postings.sample.json         (15–20 mock postings)

docker-compose.yml                   ✓ created — Chroma service on :8000
chroma-data/                         ✓ gitignored — Chroma's persistent data (created on first `docker compose up`)
.gitignore                           ✓ updated — `chroma-data/` excluded
package.json                         (root or AIServices — adds `seed:jobs` script)
```

---

## Progress tracker

| Phase | Status | Notes |
|---|---|---|
| 1 — Infrastructure | partially done (1.1, 1.2 ✓) | start container + npm install + env var still pending |
| 2 — AIServices RAG | not started | ingest route is admin/CLI-only placeholder |
| 3 — CLI seeding tool | not started | **do this before Backend/Frontend** — unblocks dev against real Chroma data |
| 4 — Backend bridge | not started | recommend route only; no upload proxy |
| 5 — Frontend | not started | no upload UI; idle → loading → list → detail |
| 6 — E2E test | not started | seed via CLI, verify upload endpoint is not exposed |
| 7 — Post-MVP | deferred | admin upload UI lives here |

---

## Appendix A — Mock data shape (`scripts/mock-data/job-postings.sample.json`)

### A.1 What the file represents

> **This dataset describes general role types / career categories — not specific openings at specific companies.** Job Discovery is a career-exploration tool for students: a student tells the system about their skills and education, and the system surfaces *kinds of roles they could pursue* and what each one involves. Each entry is a **role profile** (e.g., "Frontend Developer", "Data Analyst", "UX Designer"), not an individual posting with a company name and apply link.

- File at [scripts/mock-data/job-postings.sample.json](scripts/mock-data/job-postings.sample.json) (filename kept from the plan; semantically the contents are role profiles).
- Top-level shape: `{ "roles": [ ... ] }` (CLI seed script in 3.2.2 also accepts a bare array and normalizes).
- 15–20 entries spread across Engineering / Data / ML / Design / Product / DevOps / Mobile so vector retrieval ranks visibly differently for a frontend-heavy profile vs. a data-heavy profile.
- **Schema change required:** the original `jobPositionSchema` in **2.1.1** is modeled on per-posting fields (`company`, `applyUrl`, `postedAt`, etc.) that don't make sense for general role types. Update 2.1.1 to use the field set in A.2 below (rename to `jobRoleSchema` or keep the name — pipeline code in Phase 2/3 only depends on the *shape*, not the type name).

### A.2 Fields and how they're used for matching

| Field | Role | How it drives matching |
|---|---|---|
| `id` | identity | **UUID** (validated with `z.uuid()`) used as the Chroma document id — idempotent upsert in 2.3.2 |
| `roleName` | **role title** | embedded — vector match against profile `preferences.preferredRoles` + work history titles |
| `category` | grouping | "Engineering" / "Data" / "Design" / "Product" — supports UI grouping and filter chips |
| `overview` | embedding source | 2–3 sentence description of what someone in this role does day-to-day — condensed before embedding (see A.4) |
| `coreSkills[]` | **hard match** | the must-have skills for entry into this role — matched against profile `skills[].name` + `projects[].technologies` |
| `commonTools[]` | **soft match** | tools/frameworks/languages typically used — softer signal than `coreSkills` |
| `typicalResponsibilities[]` | **embedding source** | concrete day-to-day work — strong semantic signal for matching against profile `workExperience[].description` / `achievements` and `projects[].description` |
| `typicalEducation` | **soft match** | e.g. `"Bachelor's in CS or related"`, `"Any degree"`, `"Self-taught OK"` — matched against profile `education[].degree` |
| `entryLevelExperience` | display only | typical experience expected at entry (e.g. `"0 yrs with a portfolio"`) — shown in the detail view; **not** used for matching (level isn't a meaningful match signal for student career exploration) |
| `seniorityLevels[]` | display only | which levels exist for this role — display only; level is not a match signal |
| `typicalSalaryRange` | display | general band for the whole role (e.g. `"NZD 60–130k depending on seniority"`) |
| `commonIndustries[]` | display | where the role is commonly found (`"SaaS"`, `"Fintech"`, `"Healthcare"`, `"Gaming"`) |
| `careerPaths[]` | learning | typical next-step roles — helps students see progression |
| `relatedRoles[]` | learning | adjacent roles a student might also explore |
| `learningResources[]` | learning | optional — labels/links for resources to skill up into this role |

### A.3 Example JSON

```json
{
  "roles": [
    {
      "id": "8f3b1c2a-9d4e-4f6a-b1c2-3d4e5f6a7b8c",
      "roleName": "Frontend Developer",
      "category": "Engineering",
      "overview": "Builds the parts of websites and applications that users see and interact with. Translates designs into responsive, accessible interfaces and wires them up to backend APIs.",
      "coreSkills": ["HTML", "CSS", "JavaScript", "React or Vue or Angular", "Git"],
      "commonTools": ["TypeScript", "Vite", "Tailwind CSS", "Figma", "Chrome DevTools", "Vitest"],
      "typicalResponsibilities": [
        "Implement UI components from designs",
        "Wire components to backend APIs and handle loading/error states",
        "Optimize for performance and accessibility",
        "Write component and integration tests",
        "Collaborate with designers and backend engineers"
      ],
      "typicalEducation": "Bachelor's in CS/SE preferred but not required — a strong portfolio counts heavily",
      "entryLevelExperience": "0 yrs with a portfolio of 2–3 personal or course projects",
      "seniorityLevels": ["Intern", "Junior", "Mid", "Senior", "Lead", "Staff"],
      "typicalSalaryRange": "NZD 60–130k depending on seniority",
      "commonIndustries": ["SaaS", "E-commerce", "Fintech", "Media", "Agencies"],
      "careerPaths": ["Senior Frontend", "Full-Stack Engineer", "UX Engineer", "Frontend Architect"],
      "relatedRoles": ["Full-Stack Developer", "UX Engineer", "Mobile Developer"],
      "learningResources": ["MDN Web Docs", "React official docs", "frontendmasters.com"]
    },
    {
      "id": "2a7c9e1b-5f8d-4a3c-9e2b-1f6d8c4a7e3b",
      "roleName": "Data Analyst",
      "category": "Data",
      "overview": "Turns raw data into insights that drive business decisions. Pulls data from databases, builds dashboards, and presents findings to non-technical stakeholders.",
      "coreSkills": ["SQL", "Spreadsheets (Excel / Google Sheets)", "Data visualization", "Statistics fundamentals"],
      "commonTools": ["Python (pandas)", "Tableau", "Power BI", "Looker", "dbt", "Jupyter"],
      "typicalResponsibilities": [
        "Write SQL queries to extract data from warehouses",
        "Build dashboards and recurring reports",
        "Investigate business questions (e.g. 'why did churn spike last month?')",
        "Present findings to product and leadership teams",
        "Document data definitions and metric ownership"
      ],
      "typicalEducation": "Bachelor's in any quantitative field (CS, Stats, Maths, Economics, Engineering)",
      "entryLevelExperience": "0 yrs — internships or 1–2 personal data projects suffice",
      "seniorityLevels": ["Intern", "Junior", "Mid", "Senior", "Lead", "Analytics Manager"],
      "typicalSalaryRange": "NZD 55–105k depending on seniority",
      "commonIndustries": ["E-commerce", "Fintech", "Healthcare", "Marketing", "Consulting"],
      "careerPaths": ["Senior Analyst", "Analytics Engineer", "Data Scientist", "Product Analyst"],
      "relatedRoles": ["Data Scientist", "Analytics Engineer", "Business Intelligence Developer"],
      "learningResources": ["Mode Analytics SQL tutorial", "Kaggle Learn", "StrataScratch"]
    },
    {
      "id": "c4d6e8f0-1a2b-4c3d-8e5f-6a7b8c9d0e1f",
      "roleName": "Machine Learning Engineer",
      "category": "Data / ML",
      "overview": "Builds and deploys machine-learning models as production services. Sits between data science (research) and software engineering (shipping) — owns the full ML lifecycle from training to serving.",
      "coreSkills": ["Python", "ML frameworks (PyTorch or TensorFlow)", "Linear algebra & probability", "Software engineering fundamentals"],
      "commonTools": ["PyTorch", "scikit-learn", "FastAPI", "Docker", "MLflow", "Weights & Biases", "Vector databases"],
      "typicalResponsibilities": [
        "Train, evaluate, and tune models against business metrics",
        "Productionize models behind APIs with monitoring",
        "Build evaluation harnesses and offline experiments",
        "Collaborate with data scientists and backend engineers",
        "Maintain training pipelines and data versioning"
      ],
      "typicalEducation": "Master's or PhD in CS/ML common; a strong Bachelor's + portfolio also works",
      "entryLevelExperience": "Typically 1+ yr or research/internship experience — entry usually as ML Intern or Applied Scientist",
      "seniorityLevels": ["Intern", "Junior / Applied Scientist", "Mid", "Senior", "Staff ML Engineer"],
      "typicalSalaryRange": "NZD 85–180k depending on seniority and specialization",
      "commonIndustries": ["AI startups", "Search", "Fintech (fraud, credit)", "Healthcare", "Recommender systems"],
      "careerPaths": ["Senior ML Engineer", "ML Tech Lead", "Research Scientist", "ML Platform Engineer"],
      "relatedRoles": ["Data Scientist", "Research Engineer", "MLOps Engineer", "Applied Scientist"],
      "learningResources": ["Andrew Ng's Deep Learning Specialization", "Hugging Face course", "Full Stack Deep Learning"]
    }
  ]
}
```

> The three roles above illustrate the shape. The full file produced in **3.1.1** should contain 15–20 entries covering a clear spread of categories so vector retrieval ranks differently for, e.g., a frontend-heavy profile vs. a data-heavy profile vs. a design profile.

### A.4 What gets embedded vs what's stored

Vector quality drops fast when you stuff verbose marketing copy or display-only fields into the embedding. The Chroma document should be **a tight, match-focused projection** of the role; the full JSON above lives in `metadata` for rendering the detail view.

**Revised 2.3.1 — `buildPageContent(role)`** includes only the match-driving signals:

- `roleName`
- `category`
- `coreSkills` (comma-joined)
- `commonTools` (comma-joined)
- `typicalResponsibilities` (joined — concrete day-to-day work is one of the strongest signals for matching student project/work descriptions against what the role actually does)
- `typicalEducation`
- a **1–2 sentence** condensation of `overview` (the essence — not verbatim)

**Excluded from the embedding** (kept in metadata, used only for the detail view):
- `entryLevelExperience`, `seniorityLevels` — level/seniority is **not a match signal** for career exploration; we want the student to see all roles they could grow into, not gate by level.
- `typicalSalaryRange`, `commonIndustries`, `careerPaths`, `relatedRoles`, `learningResources` — display-only context that adds noise to the vector.

**Worked example — what gets embedded for `role_frontend_dev`:**

```
Role: Frontend Developer | Category: Engineering
Core skills: HTML, CSS, JavaScript, React or Vue or Angular, Git
Common tools: TypeScript, Vite, Tailwind CSS, Figma, Chrome DevTools, Vitest
Day-to-day: Implement UI components from designs; wire components to backend APIs and handle loading/error states; optimize for performance and accessibility; write component and integration tests; collaborate with designers and backend engineers.
Education: Bachelor's in CS/SE preferred but not required — strong portfolio counts heavily
Overview: Builds the user-facing parts of websites and apps. Translates designs into responsive UIs wired to backend APIs.
```

That string is what gets embedded and stored as Chroma `pageContent`. The full ~30-line JSON object stays in `metadata` and is what the frontend receives intact when rendering the detail view in **5.2.4**.
