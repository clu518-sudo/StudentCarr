# Task

Implement the real AI layer for the existing `Progress Tracking` feature in this repository.

The current feature is backed by mock data and mock reply generation. Replace that behavior with a LangGraph-based workflow that reads Gmail, classifies emails, drafts replies, and requires human review before a reply is confirmed.

# Repository context

- Frontend lives in `App/src`
- Backend lives in `Backend/src`
- Existing Progress Tracking backend module lives in `Backend/src/processTracking`
- Existing frontend API calls live in `App/src/lib/apiClient.js`
- Existing mock Progress Tracking UI already expects endpoints for applications, emails, email detail, reply draft, and reply confirm
- Existing backend route registration already mounts the feature at `/api/process-tracking`
- The current backend service uses dummy data and a mock reply generator in `Backend/src/processTracking/pt.service.js`

# Goal

Build the real AI-related backend for Progress Tracking so the app can:

1. Read Gmail messages for the authenticated user
2. Classify each email into a meaningful job-application intent
3. Maintain job application progress data from real email activity
4. Generate a reply draft only for invitation emails
5. Require human-in-the-loop review before a reply is confirmed/sent
6. Replace the existing dummy backend data with real data flow, while keeping the frontend contract stable

# Important constraints

- Frontend development is already finished; do not redesign the UI unless a small contract fix is required
- Keep the current frontend API shape stable wherever possible
- Do not break the existing Progress Tracking screen or its API client
- Do not silently fall back to dummy data after the AI workflow is implemented
- If Gmail access or AI configuration is missing, return a clear error instead of fabricating results
- Keep the AI workflow isolated so future changes are limited to backend service layers, not the UI
- Ensure the connection between Gmail data, AI processing, and backend persistence is consistent and does not duplicate or corrupt records

# What to build

## 1. LangGraph workflow

Create a LangGraph workflow for the Progress Tracking email pipeline.

The workflow should have clear steps such as:

- fetch Gmail messages for the authenticated user
- normalize message data
- detect job-application related emails
- classify email intent
- derive application status from the latest meaningful email
- generate a reply draft for invitation emails
- create a human review step before reply confirmation

Use LangGraph nodes and state transitions that make the workflow easy to extend later.

Suggested state should include:

- Gmail account info
- application records
- email records
- current email under review
- classification output
- reply draft output
- review/approval status

## 2. Gmail integration

Connect the workflow to Gmail for the logged-in user.

At minimum, implement the backend-side structure needed to:

- verify the user has connected Gmail
- read mailbox data securely
- fetch relevant messages
- avoid reading mail from the wrong account
- map Gmail message IDs to internal application/email IDs

If Gmail access requires OAuth tokens, refresh logic, or account linking records, add the backend functions needed to support that flow.

## 3. Email classification

Classify emails into intents that support Progress Tracking, such as:

- applied_confirmation
- follow_up
- invite
- rejection
- unknown

Derive application status from the latest meaningful intent, for example:

- applied
- under_review
- invited
- rejected
- offer

Document how the backend decides status so it remains predictable.

## 4. Reply draft generation with human-in-the-loop

For invitation emails, generate a draft reply using the AI workflow.

Requirements:

- draft must be derived from the selected invite email
- draft should be editable by the user
- draft generation should be deterministic enough to avoid random UI behavior
- the final send/confirm step must require explicit user approval
- the backend should store the reviewed draft or confirmation result

Do not auto-send emails without a review step.

## 5. Replace dummy backend data

The current mock data in `Backend/src/processTracking/pt.service.js` should no longer be the source of truth once the real workflow is in place.

Replace it with real service logic that:

- reads from Gmail and/or backend persistence
- computes application state from actual email data
- returns the same frontend-facing response shapes where possible

If you need to keep fallback data for local development, keep it behind an explicit dev-only flag or a clearly named mock mode, not as the default production path.

## 6. Backend verification for Gmail user info

Check whether the backend and frontend need extra functions to verify the Gmail user identity and account connection.

Add whatever is required to confirm:

- which Gmail account is linked
- whether the token is valid
- whether the user has permission to read the mailbox
- whether the frontend should show a "connect Gmail" or "reconnect Gmail" state

If the current API does not expose enough account verification information, add minimal endpoints or fields to support that.

# Files to inspect and likely update

- `Backend/src/processTracking/pt.service.js`
- `Backend/src/processTracking/pt.controller.js`
- `Backend/src/processTracking/pt.schemas.js`
- `Backend/src/processTracking/processTracking.routes.js`
- `Backend/src/processTracking/index.js`
- `Backend/src/routes/index.js`
- `App/src/lib/apiClient.js` only if the contract needs a small adjustment
- any backend auth/profile/Gmail connection module that stores user account info or OAuth state

# Implementation guidance

- Keep the feature modular
- Isolate Gmail access, AI classification, and reply drafting into separate functions or service objects
- Use existing backend response conventions
- Validate input and output shapes
- Log or surface errors in a way that helps diagnose Gmail or AI misconfiguration
- Add small comments only where a future Gmail/AI replacement seam is not obvious
- Prefer clear, typed object shapes or schemas for:
  - JobApplication
  - ApplicationEmail
  - EmailIntent
  - ReplyDraft
  - Gmail account verification metadata

# Expected backend behavior

- Listing applications should return real application records derived from Gmail activity or backend persistence
- Listing application emails should return the real related messages for that application
- Email detail should return the selected email body and metadata
- Reply draft should only be available for invite emails
- Confirm reply should only succeed after human review
- Missing Gmail connection or AI configuration should produce a clear, actionable error

# Human-in-the-loop rules

- The system must not send replies automatically
- The user must review and confirm the drafted reply
- The confirm endpoint should record the reviewed result and any send metadata
- If a draft changes before confirmation, the backend should use the reviewed draft that the user actually confirmed

# Deliverables

1. Real LangGraph workflow for Progress Tracking email processing
2. Gmail integration hooks and account verification flow
3. Classification logic for job-application-related emails
4. AI reply draft generation for invite emails
5. Human-in-the-loop confirmation flow
6. Replacement of dummy backend data with real service logic
7. Any minimal frontend API adjustments needed to verify Gmail connection state

# Acceptance criteria

- The frontend still works against the backend without a rewrite
- Real Gmail data can be read for the authenticated user
- Emails are classified consistently and application status is derived from those classifications
- Invite emails produce editable reply drafts
- Reply confirmation requires explicit user review
- The backend no longer depends on hard-coded mock Progress Tracking data as the primary source
- Gmail user verification is handled cleanly enough to support connect/reconnect states in the UI

# Output expectation

Implement the feature in the repository, and keep the final response concise but specific about:

- what changed
- which files were updated
- whether any Gmail verification or backend API additions were needed

