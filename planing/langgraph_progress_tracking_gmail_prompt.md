# Implementation Prompt: LangGraph Gmail Workflow For Progress Tracking

You are working in the `StudentCarr` repository. Implement the real AI-powered backend flow for the existing "Progress Tracking" feature.

## Goal

Replace the current mock `processTracking` backend logic with a real Gmail-driven workflow that runs in `AIServices/`, keeps AI concerns separate from the main backend, and preserves the existing frontend flow in `App/src/components/progress`.

The finished system should:

- let the frontend trigger an AI sync for job-hunt emails
- read Gmail messages for the authenticated user
- do a lightweight first-pass title/metadata scan before expensive processing
- only fully process relevant emails
- on first sync, only read emails from the last 7 days
- on later syncs, only read unread or unprocessed emails
- summarize emails
- classify their intent
- extract structured job-application entities needed by the frontend
- match emails to the correct application record using both company and position together
- save both raw email data and extracted structured data into the database
- generate a reply draft for invitation emails
- require human review before sending or confirming a reply

Do not rebuild the frontend from scratch. The frontend is already implemented and should be extended carefully to connect to the real backend and AI services without breaking its current component structure.

## Existing Repository Context

### Frontend

- `App/src/components/progress/ProgressView.jsx`
- `App/src/components/progress/ProgressApplicationItem.jsx`
- `App/src/components/progress/ProgressEmailList.jsx`
- `App/src/components/progress/ProgressEmailDetailPanel.jsx`
- `App/src/components/progress/InviteReplyPanel.jsx`
- `App/src/lib/apiClient.js`

The frontend already supports:

- listing applications
- expanding an application to list emails
- opening email details
- showing a draft reply for invite emails
- confirming a mock reply

Keep that shape intact and replace the current dummy flow with real data.

### Backend

- `Backend/src/processTracking/pt.service.js`
- `Backend/src/processTracking/pt.controller.js`
- `Backend/src/processTracking/pt.schemas.js`
- `Backend/src/processTracking/processTracking.routes.js`
- `Backend/src/processTracking/index.js`
- `Backend/src/routes/index.js`

Current state:

- `pt.service.js` is still hard-coded with seed application/email data.
- reply generation is still a mock function.
- no database persistence exists yet for progress-tracking emails.

### Existing AI service pattern

- `AIServices/src/generate_user_infomation.ts`
- `Backend/src/profileManagement/pm.service.js`

This repo already uses a separate local HTTP service pattern for AI work:

- AI workflow runs inside `AIServices/`
- backend calls that service over HTTP
- backend should not directly embed the LangGraph implementation

Follow that same architecture for Gmail progress tracking.

### Database

- `Backend/prisma/schema.prisma`

Current schema does not yet contain Gmail integration or progress-tracking persistence models. You need to extend it.

## Non-Negotiable Requirements

1. Keep AI workflow code inside `AIServices/`

- Build the LangGraph workflow under `AIServices/`
- Start it separately from the backend
- The backend must call the AI service over HTTP
- Do not tightly couple backend code to TypeScript runtime internals in `AIServices/`

2. Replace dummy progress-tracking data with database-backed data

- remove the hard-coded seed-only behavior in `Backend/src/processTracking/pt.service.js`
- use Prisma-backed queries for applications, emails, details, and reply drafts/history
- preserve the existing response contracts expected by the frontend where practical

3. Preserve frontend behavior and data dependencies

- the frontend’s nested components rely on extracted values such as:
  - company name
  - email address
  - job position
- the AI workflow must extract these reliably and persist them
- the email-to-application matching logic must be stable because the frontend grouping depends on it

4. Save both raw and extracted email data

- raw Gmail metadata and raw body content must be stored
- extracted AI summary/classification/entity fields must also be stored
- do not keep extraction as transient-only in memory

5. Add Gmail user verification support if needed

- check whether backend and frontend need extra logic to verify Gmail account identity or connection status
- if the current auth model is insufficient, add the minimal new endpoints/data needed

6. Human-in-the-loop reply flow

- AI can draft a reply for invitation emails
- user must review/edit before confirm
- do not auto-send without explicit user confirmation
- if real sending is too large for this pass, keep the final send step as a controlled placeholder, but all draft-generation and review flow must be real

## Product Behavior Rules

Implement the following behavior exactly:

1. Add an explicit trigger to sync progress emails

- add a button in the Progress Tracking UI to trigger the AI workflow
- that action should call the backend, and the backend should delegate to the AI service

2. First sync window

- if the user has no previously synced progress-tracking email data, only read recent 7 days of Gmail messages

3. Incremental sync behavior

- if the user already has synced progress data, only read unread emails or emails not already processed/stored
- avoid reprocessing the whole inbox each time

4. Cheap filter before full processing

- the workflow should inspect subject/title and lightweight metadata first
- only emails likely relevant to applications should go through full body fetch/extraction/classification

5. Match emails to applications carefully

- extracted company and position must both match at the same time
- if both match an existing application record, attach the email to that application
- if not, create or upsert an application record safely based on the extracted fields
- avoid attaching an email to the wrong application when a company has multiple positions

6. Invitation reply behavior

- for emails classified as `invite`, generate a draft reply
- return it to the existing frontend flow
- save draft/review state so the user can confirm after inspection

## Data Model Work Required

Update `Backend/prisma/schema.prisma` with the new persistence needed for progress tracking and Gmail integration.

At minimum, design models equivalent to the following responsibilities:

- Gmail account linkage / connection state per user
- Gmail sync state per user
- Job application tracking record
- Stored job-related email record
- Stored extracted email intelligence
- Reply draft / confirmation state

Your schema should support these concepts:

- which user owns the Gmail-linked data
- Gmail message id and thread id
- sender, recipients, subject, sent/received timestamps
- raw body text and optionally snippet/raw headers JSON
- whether the email has already been processed by AI
- extracted summary
- extracted intent / classification
- extracted company name
- extracted position title
- extracted contact email
- confidence / review metadata if useful
- relation from email to application
- reply draft text
- reply status such as `drafted`, `reviewed`, `confirmed`, `sent`, `failed`
- timestamps for sync and processing

Design the Prisma schema so later Gmail sending and background sync are still possible without a rewrite.

## Suggested Intent / Status Taxonomy

Use or extend the existing intent/status concepts already present in `Backend/src/processTracking/pt.service.js`.

Suggested email intents:

- `applied_confirmation`
- `follow_up`
- `invite`
- `rejection`
- `offer`
- `unknown`

Suggested application statuses:

- `applied`
- `under_review`
- `invited`
- `rejected`
- `offer`

The displayed application status should be derived from the latest meaningful related email, unless a stronger terminal status already exists.

## AI Service Requirements

Implement the new workflow in `AIServices/` using LangGraph.

Create a new service entry for progress tracking, for example:

- `AIServices/src/progress_tracking_gmail.ts`

If you prefer another filename, keep it consistent and wire package scripts accordingly.

### AI service responsibilities

The AI service should expose HTTP endpoints that the backend can call, such as:

- `POST /progress-tracking/sync`
- `POST /progress-tracking/reply-draft`
- `GET /health`

The exact route names can vary, but keep them explicit and backend-oriented.

### LangGraph workflow design

Build a graph with clear node boundaries. A good structure is:

1. `loadSyncContext`
- receive user identity, Gmail auth material or account reference, sync cursor/state, and existing tracked applications

2. `listCandidateMessages`
- read Gmail message list using date bounds / unread filters
- only collect lightweight metadata first

3. `filterRelevantMessages`
- use subject/snippet/headers heuristics or a cheap LLM/classifier step
- discard clearly irrelevant emails

4. `fetchFullMessages`
- fetch full content only for relevant messages

5. `extractEmailIntelligence`
- summarize the message
- classify intent
- extract company name, position title, contact email, and other useful fields
- identify whether a reply draft is needed

6. `matchOrCreateApplication`
- compare extracted company + position against existing DB-backed applications
- only treat as a match if both values align together

7. `persistResults`
- return a structured payload the backend can save safely into Prisma

8. `prepareReplyDraft`
- for invite emails, generate a professional reply draft
- make the draft editable and suitable for human review

Do not put all logic in one large prompt or one giant service function.

## Prompting Rules For Extraction

For extraction/classification steps:

- use structured output with `zod`
- instruct the model to extract only evidence supported by the email
- do not hallucinate company, position, or scheduling details
- when uncertain, return empty strings or `unknown`
- keep summaries concise and useful for frontend display

The extracted shape should support at least:

```ts
{
  summary: string;
  intent: "applied_confirmation" | "follow_up" | "invite" | "rejection" | "offer" | "unknown";
  companyName: string;
  positionTitle: string;
  contactEmail: string;
  confidence: number;
  needsReplyDraft: boolean;
  suggestedApplicationStatus: "applied" | "under_review" | "invited" | "rejected" | "offer" | "";
}
```

For invite reply drafting:

- generate polite, concise professional email replies
- avoid inventing unavailable times if the source email does not request them
- draft should be editable before confirmation

## Backend Integration Requirements

Update `Backend/src/processTracking` so it becomes the stable API layer between frontend and AI service.

### Keep or extend existing endpoints

The existing frontend already uses:

- `GET /api/process-tracking/applications`
- `GET /api/process-tracking/applications/:applicationId/emails`
- `GET /api/process-tracking/emails/:id`
- `GET /api/process-tracking/emails/:id/reply-draft`
- `POST /api/process-tracking/emails/:id/reply-confirm`

Preserve these if possible.

Add new endpoints as needed, likely including:

- `POST /api/process-tracking/sync`
- `GET /api/process-tracking/gmail/status`
- `POST /api/process-tracking/gmail/connect` or equivalent if connection metadata is required

### Backend responsibilities

The backend should:

- authenticate the user
- load/store Prisma data
- call the AI service over HTTP
- isolate Gmail auth tokens/secrets from the frontend when appropriate
- translate AI-service outputs into DB writes and frontend response shapes
- handle retries/errors cleanly

The backend should not:

- host the LangGraph logic directly
- depend on frontend-only assumptions
- lose raw email records after extraction

## Gmail Integration Requirements

Implement the minimum viable Gmail integration needed for this feature.

Check what is missing and add it:

- Gmail OAuth/account verification state
- storage for refresh/access token or a safe reference to them
- backend logic to confirm the connected Gmail identity belongs to the current user
- frontend state to show whether Gmail is connected before sync is triggered

If full Gmail OAuth setup is too large for the implementation window, still design the backend/frontend/API contracts so a real Gmail token flow can be plugged in cleanly. But do not leave the architecture vague.

## Frontend Changes Required

The frontend is mostly finished, but verify and extend it carefully.

Required frontend work:

- add a button in `ProgressView.jsx` to trigger AI sync
- show sync loading state and error state
- if needed, show Gmail connection status or missing-connection warning
- keep current application/email/detail/reply panels working with real backend data
- if there is existing email data in the UI, sync should only fetch unread/unprocessed emails on later runs

Do not redesign the whole page. Keep the existing component layout unless a small change is necessary for the new flow.

## Persistence and Matching Rules

These rules are important:

1. Save both raw and extracted email data
- raw Gmail fields must remain available for debugging/audit
- extracted fields must be queryable for frontend rendering

2. Application matching must use both company and position
- do not match by company alone
- do not match by title alone

3. Avoid duplicate emails
- use Gmail message id as an idempotency anchor
- repeat syncs must not create duplicate records

4. Track processing state
- know whether a message was discovered, filtered, fully fetched, extracted, draft-generated, confirmed, or sent

## Error Handling

Handle these cases clearly:

- Gmail account not connected
- Gmail identity mismatch or missing verification info
- AI service unavailable
- Gmail API failure
- malformed AI output
- duplicate message sync
- invite reply requested for a non-invite email

Return useful backend errors. Do not silently fall back to seed data.

## Implementation Expectations

- match the existing code style as closely as practical
- keep new code modular
- add comments only where future integration points are not obvious
- avoid giant files where small modules would reduce confusion
- do not break existing auth or profile-management flows

## Verification

After implementation, verify at least the following:

1. Prisma migration succeeds for the new progress-tracking / Gmail models.
2. Backend starts and existing auth still works.
3. AI service starts separately and exposes a health endpoint.
4. Triggering progress sync from the frontend calls the backend successfully.
5. First sync only reads recent 7 days.
6. Later syncs only ingest unread or unprocessed emails.
7. Duplicate Gmail messages are not inserted twice.
8. Applications list is now DB-backed instead of mock-seeded.
9. Email detail view shows stored raw body content.
10. Invite emails return a generated draft that can be reviewed and confirmed by the user.

## Acceptance Criteria

- `Backend/src/processTracking/pt.service.js` no longer relies on hard-coded seed data for the main flow.
- New Prisma models exist for Gmail-linked progress tracking persistence.
- Raw email data and extracted AI data are both stored in the database.
- A LangGraph workflow exists in `AIServices/` for Gmail progress tracking.
- The AI workflow is started separately from the backend and called over HTTP.
- The frontend can trigger sync with a button.
- First sync reads only the last 7 days of Gmail.
- Incremental sync processes only unread or otherwise unprocessed emails after that.
- Email extraction includes company name, position title, and contact email for frontend grouping.
- Application matching requires both company and position to align.
- Invite reply drafting uses human-in-the-loop review before confirmation.
- Existing frontend progress-tracking flows remain usable with real data.

## Deliverable

Implement the code changes in this repository. Do not only describe the plan. Update backend, frontend, Prisma schema, and `AIServices/` so the progress-tracking feature moves from mock data to a real Gmail + LangGraph architecture with database persistence and human-reviewed reply drafting.
