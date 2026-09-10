---
name: LangGraph Profile Draft
overview: Replace the backend’s hard-coded manual profile generator with a preview-only LangGraph service in `AIServices` that reads `ProfileDocument.parsedText`, produces a validated manual-profile draft, and returns it to the existing SSE generation flow without persisting changes.
todos:
  - id: schema-and-contract
    content: Map the backend manual profile schema and normalization rules into an AIServices-side Zod contract and sanitization layer.
    status: completed
  - id: langgraph-service
    content: Design the AIServices local HTTP endpoint and LangGraph node flow for prepare, extract, merge, and validate.
    status: completed
  - id: backend-integration
    content: Plan the backend-only parsedText query and replace dummy generation with preview-only HTTP integration.
    status: completed
  - id: verification
    content: Verify type checks, backend tests if available, and a manual streamed generation flow without persistence.
    status: completed
isProject: false
---

# LangGraph Profile Draft

## Goal

Implement a local AI generation service in [f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\AIServices\src\generate_user_infomation.ts](f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\AIServices\src\generate_user_infomation.ts) and wire [f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\Backend\src\profileManagement\pm.service.js](f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\Backend\src\profileManagement\pm.service.js) to call it, so `/manual/generate/stream` returns an AI-generated draft in the existing manual profile shape without writing anything to the database.

## Current Constraints

- [f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\Backend\src\profileManagement\pm.service.js](f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\Backend\src\profileManagement\pm.service.js) currently uses `createDummyGeneratedProfile(...)`, waits with fake `sleep(...)` calls, then persists the generated result with `upsertManualProfileForUser(...)`; that persistence must be removed from the generation flow.
- [f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\Backend\src\profileManagement\pm.schemas.js](f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\Backend\src\profileManagement\pm.schemas.js) is the source of truth for the response shape and required fields such as `education.school`, `workExperience.company`, `workExperience.title`, `projects.name`, `skills.name`, and `certifications.name`.
- [f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\Backend\prisma\schema.prisma](f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\Backend\prisma\schema.prisma) stores extracted document text in `ProfileDocument.parsedText`, but the current `mapDocument(...)` / `documentListSelect` path intentionally does not expose it to the normal frontend API.
- [f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\AIServices\src\generate_user_infomation.ts](f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\AIServices\src\generate_user_infomation.ts) is only a stub today, and [f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\AIServices\package.json](f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\AIServices\package.json) still points `npm run dev` at a non-existent `src/demo.ts`, so the service entrypoint/scripts need to be made real as part of the work.

## Target Flow

```mermaid
flowchart LR
backendGenerate[Backend generateManualProfileForUserDummy] --> dbDocs[Query ProfileDocument with parsedText]
backendGenerate --> currentProfile[Load current manual profile]
dbDocs --> aiRequest[POST to AIServices local endpoint]
currentProfile --> aiRequest
aiRequest --> graph[LangGraph prepare extract merge validate]
graph --> aiResponse[Validated manual profile draft]
aiResponse --> sseResult[Existing SSE completed result]
sseResult --> frontendReview[Frontend review and save later]
```

## Implementation Plan

1. Build a shared manual-profile schema and sanitization layer inside `AIServices`.
   Use the shape in [f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\Backend\src\profileManagement\pm.schemas.js](f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\Backend\src\profileManagement\pm.schemas.js) to mirror the backend contract in Zod on the AI side. Add helpers to normalize empty strings, empty arrays, optional `yearsOfExperience`, and to drop invalid list items before returning a draft.

2. Implement the LangGraph workflow in `AIServices` as an HTTP-accessible local service.
   Expand [f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\AIServices\src\generate_user_infomation.ts](f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\AIServices\src\generate_user_infomation.ts) from a stub into a real graph with nodes equivalent to `prepareDocuments`, `extractProfile`, `mergeWithCurrentProfile`, and `validateProfile`. The service should accept `currentManualProfile` plus documents containing `documentType`, `originalName`, and `parsedText`, call `ChatOpenAI` with structured output, preserve manual values when extraction is empty, and return a final `ManualProfile` JSON object.

3. Fix `AIServices` runtime wiring so the service is actually runnable.
   Update [f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\AIServices\package.json](f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\AIServices\package.json) scripts to point at the real entrypoint instead of `src/demo.ts`, and add the minimal HTTP server dependency or built-in Node server setup needed to expose a fixed local endpoint. Keep env loading aligned with [f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\AIServices\.example.env](f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\AIServices.example.env), supporting `OPENAI_API_KEY`, `OPENAI_MODEL` or the existing compatible-host variables without hardcoding secrets.

4. Add a backend-only document query that includes `parsedText`.
   In [f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\Backend\src\profileManagement\pm.service.js](f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\Backend\src\profileManagement\pm.service.js), keep the existing public `mapDocument(...)` behavior unchanged, but add a private query such as `listDocumentsWithParsedTextForUser(userId)` that selects `id`, `documentType`, `originalName`, `parserStatus`, `parsedText`, and timestamps for generation only. This preserves the current API contract while giving the AI workflow the evidence it needs.

5. Replace the dummy generator with a preview-only backend integration.
   Refactor `generateManualProfileForUserDummy(userId, onProgress)` in [f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\Backend\src\profileManagement\pm.service.js](f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\Backend\src\profileManagement\pm.service.js) so it still loads `getProfileForUser(userId)`, still throws `400` when no documents exist, and still emits meaningful progress messages, but no longer uses `sleep(...)`, `createDummyGeneratedProfile(...)`, or `upsertManualProfileForUser(...)`. Instead, fetch the parsed documents, call the local `AIServices` endpoint, and return `{ ...current, manualProfile: generatedManualProfile }` directly so the frontend review/save flow remains in control.

6. Make error handling explicit and user-safe across both sides.
   Handle three distinct failures: no uploaded documents, documents present but no usable `parsedText`, and AI/config/runtime errors. The backend should surface clear errors through the existing stream path and never silently fall back to dummy content. The AI service should reject fabricated or structurally invalid output by sanitizing and validating before responding.

7. Verify the integration without changing frontend contracts.
   Run `AIServices` type checks, run backend tests if present, and manually exercise the stream generation path with at least one document row that already has `parsedText`. Confirm that the SSE result still returns the same `manualProfile` shape the frontend expects, but the database remains unchanged until the user uses the existing save action.

## Files Likely To Change

- [f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\AIServices\src\generate_user_infomation.ts](f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\AIServices\src\generate_user_infomation.ts)
- [f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\AIServices\package.json](f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\AIServices\package.json)
- [f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\AIServices\tsconfig.json](f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\AIServices\tsconfig.json) only if needed for the service entrypoint or emitted build layout
- [f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\AIServices\.example.env](f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\AIServices.example.env) if the env contract needs to be clarified
- [f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\Backend\src\profileManagement\pm.service.js](f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\Backend\src\profileManagement\pm.service.js)
- [f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\Backend\src\profileManagement\pm.schemas.js](f:\03_MyProgrames\02_StudentCarr_Vite\StudentCarr_vite\StudentCarr\StudentCarr\Backend\src\profileManagement\pm.schemas.js) only if generation-specific validation helpers need to be shared or clarified

## Main Risks To Watch

- The current backend generation function writes to the database; missing that removal would violate the preview-only requirement.
- Public document responses intentionally omit `parsedText`; reusing that path directly would starve the AI workflow or accidentally leak document text to the frontend.
- `AIServices` currently has no runnable local API entrypoint, so backend integration depends on making that runtime path explicit and stable.
- The AI output must stay aligned with the backend manual profile contract, especially required list item fields and `yearsOfExperience` handling.
- The current env template is oriented around a compatible OpenAI host; implementation should preserve that flexibility while making missing-config errors clear.
