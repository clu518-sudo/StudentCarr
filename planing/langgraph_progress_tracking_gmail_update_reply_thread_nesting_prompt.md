# Implementation Prompt: Nest Gmail Replies In Progress Tracking

You are working in the `StudentCarr` repository. Implement a focused upgrade to the existing Progress Tracking feature so reply emails are modeled and rendered as part of the same conversation instead of being treated as flat, unrelated emails.

## Goal

The repository already has:

- a Gmail-backed progress tracking workflow in `AIServices/src/progress_tracking_gmail.ts`
- Prisma-backed persistence for tracked applications and emails
- a frontend Progress Tracking UI in `App/src/components/progress`

The current implementation still treats every synced email as a standalone record for UI listing and AI extraction. That is no longer sufficient.

Implement reply-aware conversation handling so that:

- emails in the same Gmail thread can be linked by parent/child reply relationship
- only top-level conversation roots should appear as primary email list items for an application
- reply emails should be nested under the selected/root email in `ProgressEmailDetailPanel.jsx`
- reply emails should not create additional flat rows in `ProgressApplicationItem.jsx` / `ProgressEmailList.jsx`
- AI extraction, intent recognition, classification, and reply-draft context should operate on the full conversation context, not isolated single emails

Do not only describe the change. Implement it in this repository.

## Existing Files To Review And Update

Frontend:

- `App/src/components/progress/ProgressView.jsx`
- `App/src/components/progress/ProgressApplicationItem.jsx`
- `App/src/components/progress/ProgressEmailList.jsx`
- `App/src/components/progress/ProgressEmailDetailPanel.jsx`
- `App/src/components/progress/InviteReplyPanel.jsx`

Backend:

- `Backend/src/processTracking/pt.service.js`
- `Backend/src/processTracking/pt.controller.js`
- `Backend/src/processTracking/pt.schemas.js`
- `Backend/src/processTracking/processTracking.routes.js`

Database:

- `Backend/prisma/schema.prisma`

AI workflow:

- `AIServices/src/progress_tracking_gmail.ts`

You may add small helper modules if they make the implementation cleaner, but preserve the current architecture:

- AI workflow stays in `AIServices/`
- backend remains the API and persistence layer
- frontend keeps the current overall component structure

## Current Problem

Right now the code stores and renders emails roughly as flat items:

- `listEmailsForApplication(...)` returns every related email as a separate row
- `ProgressEmailList.jsx` renders those rows directly
- `ProgressEmailDetailPanel.jsx` only displays one selected email body and metadata
- `AIServices/src/progress_tracking_gmail.ts` extracts intelligence one message at a time
- no explicit reply parent/child relationship is persisted on `ProgressEmail`

That causes these product issues:

- a reply in the same Gmail conversation appears like a separate top-level progress email
- the UI cannot show a real conversation thread
- AI classification can be wrong because context from previous emails in the thread is ignored
- extracted company/position/contact data may be weaker when derived from one message instead of the whole conversation

## Required Product Behavior

Implement the following behavior exactly:

1. Reply emails must be nested

- if email `B` is a reply to email `A` in the same conversation, `B` must be attached under `A`
- nested replies should be shown in `ProgressEmailDetailPanel.jsx`
- nested replies should not also appear as separate peer items in the application email list

2. Only root emails should drive the application email list

- the list shown inside an expanded `ProgressApplicationItem.jsx` should contain only top-level/root conversation entries for that application
- reply descendants should be available inside the selected thread detail view instead of the flat list

3. Relationship must come from Gmail conversation data during AI sync

- determine reply/thread structure during Gmail fetch/sync
- do not rely on frontend heuristics to infer nesting after the fact if backend/AI workflow can determine it more reliably
- store enough metadata so the relationship survives page refresh and future syncs

4. AI logic must use conversation context

- extraction, classification, intent recognition, summary generation, and reply-draft generation should be based on all emails in one conversation where possible
- use the ordered thread context to improve accuracy
- still preserve per-message raw data for audit/debugging

## Threading / Reply Relationship Requirements

Use Gmail thread/message metadata plus headers to infer reply relationships as reliably as possible.

At minimum, evaluate these sources:

- Gmail `threadId`
- `Message-ID`
- `In-Reply-To`
- `References`
- sent/received timestamps

Design the implementation so each `ProgressEmail` can answer:

- which Gmail thread it belongs to
- whether it is a root/top-level conversation item
- which stored email is its parent reply, if any
- what order it appears in within the thread

If Gmail does not provide enough information to determine a direct parent confidently, fall back to a deterministic best-effort strategy within the same Gmail thread and document that logic in code comments only where necessary.

## Data Model Changes

Extend `Backend/prisma/schema.prisma` to persist reply-aware structure.

Update `ProgressEmail` with fields equivalent to the following responsibilities:

- raw RFC message id / internet message id
- `inReplyTo` header value
- `references` header values
- `parentEmailId` self-reference for nested replies
- ability to query child replies
- boolean or derived signal for root emails if helpful
- stable sort position / thread timestamps if useful

Suggested shape direction:

```prisma
model ProgressEmail {
  id                String @id @default(uuid())
  ...
  gmailThreadId     String?
  rfcMessageId      String? @map("rfc_message_id")
  inReplyTo         String? @map("in_reply_to")
  referencesHeader  Json?   @map("references_header")
  parentEmailId     String? @map("parent_email_id")
  parentEmail       ProgressEmail?  @relation("ProgressEmailReplies", fields: [parentEmailId], references: [id], onDelete: SetNull)
  childReplies      ProgressEmail[] @relation("ProgressEmailReplies")
  ...
}
```

You do not need to use these exact names, but the persisted model must support nested rendering and incremental sync updates.

Also add the indexes needed for:

- `gmailThreadId`
- `rfcMessageId`
- `parentEmailId`

Preserve existing unique/idempotency protection on Gmail message ids.

## AI Workflow Requirements

Update `AIServices/src/progress_tracking_gmail.ts` so sync operates at thread-aware/conversation-aware level.

### Required workflow behavior

1. Candidate discovery

- continue doing a cheap first pass on Gmail metadata
- keep first sync limited to recent 7 days
- keep later sync incremental

2. Full message fetch

- for relevant candidates, fetch enough Gmail metadata and headers to reconstruct thread relationships
- make sure `Message-ID`, `In-Reply-To`, and `References` are requested/extracted

3. Conversation grouping

- group related messages by Gmail thread id
- sort each conversation chronologically
- determine parent/child reply structure inside the conversation

4. Conversation-level extraction

- run extraction/classification against the ordered conversation, not just each individual message body in isolation
- still preserve a per-message raw payload in the sync result so backend persistence remains auditable

5. Output shape

- return enough information for backend persistence of both:
  - the individual messages
  - the conversation-derived intelligence
  - the parent/child reply linkage

### Extraction rules

Use structured output with `zod`.

The model should be told:

- analyze the full conversation in chronological order
- identify the latest meaningful application state from the whole conversation
- extract company, position, and contact details using the whole thread as evidence
- do not invent details not supported by the thread
- when uncertain, use empty strings or `unknown`
- generate concise thread-level summaries suitable for the UI

You may keep per-message extraction if needed, but the final application/status/intelligence used by the product should be conversation-aware.

### Reply draft generation

For invite threads:

- generate the reply draft using the full conversation context
- do not generate based only on the currently selected single message if thread context is available
- preserve human review before send

## Backend Requirements

Update `Backend/src/processTracking/pt.service.js` and related files so the backend exposes reply-aware data contracts.

### Persistence behavior

When sync results are persisted:

- save raw message headers/body as before
- save threading metadata (`rfcMessageId`, `inReplyTo`, `references`, `parentEmailId`, etc.)
- connect replies to their parent emails
- make persistence idempotent across repeated syncs
- support cases where a parent message is synced in one run and a child reply arrives in a later run

### Application matching behavior

Application matching should still use both company and position together.

However, when intelligence is now conversation-derived:

- use the thread-aware extraction result when deciding application association
- ensure all emails in the same conversation are attached consistently to the same application where appropriate

### API response changes

Adjust backend response shapes so frontend can render thread roots and nested replies cleanly.

At minimum:

1. `GET /api/process-tracking/applications/:applicationId/emails`

- return only root/top-level emails for the list view, or return all emails plus a field that clearly marks roots and children
- prefer a backend-shaped response that minimizes frontend data-massaging

2. `GET /api/process-tracking/emails/:id`

- return the selected email detail plus nested replies in chronological order
- include enough metadata for the detail panel to show who replied, when, and the message body

Suggested response direction:

```json
{
  "email": {
    "id": "...",
    "subject": "...",
    "sender": "...",
    "date": "...",
    "summary": "...",
    "body": "...",
    "intent": "invite",
    "companyName": "...",
    "positionTitle": "...",
    "contactEmail": "...",
    "replies": [
      {
        "id": "...",
        "sender": "...",
        "senderEmail": "...",
        "subject": "...",
        "date": "...",
        "body": "...",
        "intent": "follow_up",
        "summary": "..."
      }
    ]
  }
}
```

You may include deeper nesting recursively or as a flat ordered reply list under the selected root, but the result must let the frontend render an obvious threaded conversation.

### Backward compatibility

Keep existing endpoint paths if possible. It is acceptable to extend the response shape as long as current progress-tracking behavior remains coherent.

## Frontend Requirements

Update the existing progress components without redesigning the page.

### `ProgressEmailList.jsx`

- render only root conversation items for the application
- keep selection behavior simple
- if useful, show a reply count badge or thread indicator for emails that have nested replies

### `ProgressEmailDetailPanel.jsx`

- continue showing the selected root email prominently
- add a nested/threaded reply section below it
- render replies in chronological order
- make the UI clearly distinguish the main/root email from subsequent replies
- include sender/date/body/summary where appropriate
- keep the design aligned with the current component style

### `ProgressView.jsx`

- ensure selection and refresh logic still works when email detail now includes nested replies
- after sync, if a previously selected root email still exists, reload its detail including nested replies
- do not break invite-reply drafting flow

### `ProgressApplicationItem.jsx`

- do not let child replies inflate the visible top-level list
- keep the current application card layout intact

## Important Logic Rules

1. Do not create separate top-level list rows for reply children.
2. Do not infer application matches using company alone.
3. Do not infer application matches using title alone.
4. Do not lose raw per-message email bodies and headers.
5. Do not move AI logic into the backend.
6. Do not make the frontend reconstruct the whole reply tree from raw Gmail headers if the backend can provide a cleaner shape.

## Edge Cases To Handle

- a thread where only later replies are synced first
- missing or malformed `In-Reply-To` / `References`
- multiple replies under the same parent
- thread messages with the same subject but no trustworthy reply linkage
- older parent/root messages outside the first-sync time window
- a selected email becoming a child after a later sync reconnects the parent/root relationship
- invite intent determined from the full conversation even if the latest email alone is ambiguous

## Verification

After implementation, verify at least the following:

1. Prisma migration succeeds with the new reply/threading fields.
2. Sync persists threading metadata for Gmail messages.
3. Repeated syncs do not duplicate messages.
4. Reply emails are attached to parent/root emails in storage.
5. `list application emails` no longer shows reply children as top-level peer rows.
6. `get email detail` returns nested replies for the selected thread.
7. `ProgressEmailDetailPanel.jsx` renders the conversation thread correctly.
8. AI extraction/classification uses ordered conversation context rather than isolated single-email context.
9. Invite reply draft generation still works and now benefits from full thread context.

## Acceptance Criteria

- Reply relationships are persisted in Prisma-backed progress email data.
- Top-level application email lists show only root conversation entries.
- Nested replies render inside `ProgressEmailDetailPanel.jsx`.
- Reply children no longer appear as duplicate top-level items in the flat email list.
- Gmail sync reconstructs thread structure using Gmail metadata/headers.
- AI extraction and intent classification are conversation-aware.
- Existing progress tracking architecture remains intact: frontend -> backend -> `AIServices/`.

## Deliverable

Implement the code changes in this repository. Do not stop at a plan. Update Prisma schema, backend process-tracking services, AI workflow, and frontend progress components so reply emails are nested and conversation-aware throughout the Progress Tracking feature.
