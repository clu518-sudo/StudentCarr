---
name: Progress Tracking Scaffold
overview: Implement a mock end-to-end Progress Tracking feature spanning `App/src` and `Backend/src/processTracking`, with clear extension points for future Gmail ingestion and AI reply generation.
todos:
  - id: audit-current-progress-view
    content: Inspect current progress view and shared UI/API patterns; finalize component split for the new flow.
    status: completed
  - id: build-backend-process-tracking-module
    content: Implement `Backend/src/processTracking` mock routes/controller/service and register `/api/process-tracking` in backend route index.
    status: completed
  - id: extend-frontend-api-client
    content: Add `progressTrackingApi` methods in `App/src/lib/apiClient.js` matching backend endpoints/contracts.
    status: completed
  - id: implement-progress-ui-flow
    content: Build/compose progress components and wire end-to-end interactions in `ProgressView.jsx` (expand emails, detail, invite draft, confirm).
    status: completed
  - id: verify-behavior-and-lints
    content: Run flow checks and lint checks on modified files; address introduced issues.
    status: completed
isProject: false
---

# Progress Tracking Implementation Plan

## Scope and alignment

- Implement the feature described in `[F:/03_MyProgrames/02_StudentCarr_Vite/StudentCarr_vite/StudentCarr/StudentCarr/progress_tracking_implementation_prompt.md](F:/03_MyProgrames/02_StudentCarr_Vite/StudentCarr_vite/StudentCarr/StudentCarr/progress_tracking_implementation_prompt.md)`.
- Keep current frontend route `"/progress"` and evolve existing `[F:/03_MyProgrames/02_StudentCarr_Vite/StudentCarr_vite/StudentCarr/StudentCarr/App/src/components/progress/ProgressView.jsx](F:/03_MyProgrames/02_StudentCarr_Vite/StudentCarr_vite/StudentCarr/StudentCarr/App/src/components/progress/ProgressView.jsx)` instead of creating a parallel route.
- Add backend module under `[F:/03_MyProgrames/02_StudentCarr_Vite/StudentCarr_vite/StudentCarr/StudentCarr/Backend/src/processTracking](F:/03_MyProgrames/02_StudentCarr_Vite/StudentCarr_vite/StudentCarr/StudentCarr/Backend/src/processTracking)` and expose it under `/api/process-tracking` via `[F:/03_MyProgrames/02_StudentCarr_Vite/StudentCarr_vite/StudentCarr/StudentCarr/Backend/src/routes/index.js](F:/03_MyProgrames/02_StudentCarr_Vite/StudentCarr_vite/StudentCarr/StudentCarr/Backend/src/routes/index.js)`.

## Frontend changes (`App/src`)

- Extend `[F:/03_MyProgrames/02_StudentCarr_Vite/StudentCarr_vite/StudentCarr/StudentCarr/App/src/lib/apiClient.js](F:/03_MyProgrames/02_StudentCarr_Vite/StudentCarr_vite/StudentCarr/StudentCarr/App/src/lib/apiClient.js)` with a `progressTrackingApi` object:
  - `listApplications()`
  - `listApplicationEmails(applicationId)`
  - `getEmailDetail(emailId)`
  - `getInviteReplyDraft(emailId)`
  - `confirmInviteReply(emailId, body)`
- Build feature-local UI components in `[F:/03_MyProgrames/02_StudentCarr_Vite/StudentCarr_vite/StudentCarr/StudentCarr/App/src/components/progress](F:/03_MyProgrames/02_StudentCarr_Vite/StudentCarr_vite/StudentCarr/StudentCarr/App/src/components/progress)`:
  - application list + item (expand/collapse)
  - related email list + email row
  - email detail panel
  - editable invite reply panel with confirm action and mock completion feedback
- Keep orchestration/state in `ProgressView` (selected application, selected email, draft text, loading/error/success flags) and keep presentational components mostly stateless.
- Use existing visual conventions (`.card`, `.btn-primary`, gradients, spacing) to remain consistent with other views.

## Backend changes (`Backend/src/processTracking`)

- Create module files:
  - `[F:/03_MyProgrames/02_StudentCarr_Vite/StudentCarr_vite/StudentCarr/StudentCarr/Backend/src/processTracking/index.js](F:/03_MyProgrames/02_StudentCarr_Vite/StudentCarr_vite/StudentCarr/StudentCarr/Backend/src/processTracking/index.js)`
  - `[F:/03_MyProgrames/02_StudentCarr_Vite/StudentCarr_vite/StudentCarr/StudentCarr/Backend/src/processTracking/processTracking.routes.js](F:/03_MyProgrames/02_StudentCarr_Vite/StudentCarr_vite/StudentCarr/StudentCarr/Backend/src/processTracking/processTracking.routes.js)`
  - `[F:/03_MyProgrames/02_StudentCarr_Vite/StudentCarr_vite/StudentCarr/StudentCarr/Backend/src/processTracking/pt.controller.js](F:/03_MyProgrames/02_StudentCarr_Vite/StudentCarr_vite/StudentCarr/StudentCarr/Backend/src/processTracking/pt.controller.js)`
  - `[F:/03_MyProgrames/02_StudentCarr_Vite/StudentCarr_vite/StudentCarr/StudentCarr/Backend/src/processTracking/pt.service.js](F:/03_MyProgrames/02_StudentCarr_Vite/StudentCarr_vite/StudentCarr/StudentCarr/Backend/src/processTracking/pt.service.js)`
  - optional validation file: `[F:/03_MyProgrames/02_StudentCarr_Vite/StudentCarr_vite/StudentCarr/StudentCarr/Backend/src/processTracking/pt.schemas.js](F:/03_MyProgrames/02_StudentCarr_Vite/StudentCarr_vite/StudentCarr/StudentCarr/Backend/src/processTracking/pt.schemas.js)` for POST body validation.
- Provide stable mock data contracts and mock handlers for:
  - list applications
  - list related emails by application
  - get one email detail
  - get/generate invite reply draft
  - confirm mock send
- Follow existing response shape (`{ success, data }` and structured errors) used by auth/profile modules.

## Data contracts and behavior

- Define and enforce feature-level shapes for:
  - `JobApplication`
  - `ApplicationEmail`
  - `EmailIntent` (`applied_confirmation | follow_up | invite | rejection | unknown`)
  - `ReplyDraft`
- Backend mock logic computes/returns application status (`applied | under_review | invited | rejected | offer`) from latest meaningful email intent/timestamp.
- Frontend rule: show editable reply panel only when selected email intent is `invite`.
- Confirm flow returns deterministic mock success so UI can mark the draft as sent/confirmed.

## Future integration extension points

- In `pt.service.js`, isolate mock providers behind clearly named functions/interfaces (e.g., `emailSourceProvider`, `intentClassifier`, `replyDraftGenerator`) so they can later call Gmail/AIServices without rewriting controllers or frontend callers.
- Add short comments only where these replacement seams are non-obvious.
- Keep endpoint contracts stable so swapping mock logic for real integration remains internal to the service layer.

## Delivery flow

```mermaid
flowchart TD
  ProgressView[ProgressView] --> ApiClient[progressTrackingApi]
  ApiClient --> BackendRoutes[/api/process-tracking routes]
  BackendRoutes --> PtController[pt.controller]
  PtController --> PtService[pt.service mock providers]
  PtService --> MockStore[(mock applications and emails)]
```

## Validation and checks

- Smoke-test frontend flow: list -> expand -> select email -> view detail -> invite draft edit -> confirm success state.
- Smoke-test backend routes with representative IDs and error cases (missing/invalid IDs, non-invite draft request).
- Run lint checks on touched files and resolve newly introduced issues before finalizing.
