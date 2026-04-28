Implement a TipTap rich text editor for the Progress Tracking email reply context panel.

Repository context:

- Frontend lives in `App/src`
- Backend lives in `Backend/src`
- Progress Tracking frontend state is managed in `App/src/contexts/ProgressContext.jsx`
- The selected email detail is rendered by `App/src/components/progress/ProgressEmailDetailPanel.jsx`
- The current reply editor is `App/src/components/progress/InviteReplyPanel.jsx`
- Progress Tracking page composition is in `App/src/components/progress/ProgressView.jsx`
- API functions are in `App/src/lib/apiClient.js`
- Backend Progress Tracking routes/controllers/services live in `Backend/src/processTracking`
- Current reply confirmation endpoint is `POST /api/process-tracking/emails/:id/reply-confirm`
- Current backend schema accepts `{ draftText }` and sends plain text through `confirmInviteReplySend`
- Prisma model `ProgressEmailReply` currently stores `draftText` and `reviewedText` as plain strings

Goal:

Replace the plain `<textarea>` reply draft editor with a polished TipTap editor in the invite email reply panel, while preserving the existing human-reviewed Gmail send workflow. The user should be able to review and edit AI-generated reply drafts with common rich text controls before confirming send.

Current behavior to preserve:

- Selecting an invite email loads email detail through `progressTrackingApi.getEmailDetail`
- If the selected email intent is `invite`, `ProgressContext.loadSelectedEmailState` calls `progressTrackingApi.getInviteReplyDraft`
- The returned draft is stored in `draftText`
- `InviteReplyPanel` renders only when `visible={isInviteEmail}`
- Confirm send calls `handleConfirmReply`
- `handleConfirmReply` posts `{ emailId: selectedEmailId, draftText }` through `progressTrackingApi.confirmInviteReply`
- Backend validates `draftText` in `Backend/src/processTracking/pt.schemas.js`
- Backend formats the text using `formatDraftEmailText` and sends through the AI service `/progress-tracking/send-reply`

Feature requirements:

1. Add TipTap dependencies

- Add the required TipTap packages to `App/package.json`
- Use the minimal packages needed for a professional email reply editor:
  - `@tiptap/react`
  - `@tiptap/starter-kit`
  - any extra TipTap extension only if it is actually used
- Keep dependency changes scoped to the frontend app.

2. Create a reusable TipTap editor component

- Add a component under `App/src/components/progress`, for example `RichReplyEditor.jsx`
- It must be a controlled editor from the caller's perspective
- It must accept at least:
  - `value`
  - `onChange`
  - `disabled`
  - `placeholder`
- It should support converting the existing plain text draft into editor content without losing paragraph breaks
- It should emit a send-safe text value back to the existing `draftText` state so the backend contract can remain unchanged in the first implementation
- Avoid storing editor-only state in `ProgressContext` unless necessary

3. Replace the textarea in `InviteReplyPanel.jsx`

- Replace the current `<textarea>` with the new TipTap editor component
- Keep the existing panel visibility, loading, confirmation message, confirm button, and disabled state behavior
- The confirm button must remain disabled when the editor content is effectively empty
- Preserve the current `draftText` / `onDraftChange` props so `ProgressView.jsx` and `ProgressContext.jsx` require minimal changes

4. Editor toolbar requirements

- Include a compact toolbar above the editor content
- At minimum support:
  - bold
  - italic
  - bullet list
  - ordered list
  - undo
  - redo
- Use clear button states for active marks/nodes
- Use accessible labels or titles for toolbar buttons
- Keep the toolbar visually consistent with the existing Tailwind/card style
- Do not add a heavy email-composer redesign; this is an editor upgrade inside the existing reply panel.

5. Email-safe content handling

- For this implementation, preserve the existing backend contract by submitting plain text as `draftText`
- TipTap content should be converted to clean plain text before storing in `draftText`
- Preserve useful paragraph/list spacing as much as possible
- Do not send raw TipTap JSON to the existing endpoint
- Do not send HTML unless the backend and AI service are explicitly updated in the same implementation
- If adding HTML support, add it deliberately:
  - add `draftHtml` to frontend API payload
  - update `pt.schemas.js`
  - update `ProgressEmailReply` persistence through a Prisma migration
  - update Gmail send logic to pass both text and HTML safely
  - keep backwards compatibility with existing plain text records

6. Styling requirements

- Match existing Tailwind conventions from `App/src/index.css`
- Keep the editor readable in the current right-side context panel layout
- Use stable dimensions so the toolbar and editor do not jump during editing
- Add focused, subtle border/ring styling similar to existing form controls
- Ensure list formatting is visible inside the editor, since Tailwind preflight may remove default list styles
- Make sure long email text wraps cleanly on desktop and mobile

7. State and lifecycle requirements

- When a new invite email is selected, the editor must update to the newly loaded AI draft
- When email selection is cleared, existing `draftText` reset behavior must still clear the editor
- The editor must not overwrite user edits during normal typing
- Loading state must not initialize TipTap with stale content
- Confirming send should use the latest edited content

8. Backend requirements

- Do not change backend behavior unless necessary for the frontend implementation
- If keeping plain text only, no backend schema or Prisma change should be required
- Confirm that `confirmInviteReplySend` still receives a non-empty plain `draftText`
- Preserve `formatDraftEmailText` behavior
- Preserve existing Gmail send flow and error handling

9. Testing and verification

- Run the frontend build from `App/`
- If practical, run the backend test/build/lint command used by the repo
- Manually verify these flows in the UI:
  - open Progress Tracking
  - select an invite email
  - AI draft appears in the TipTap editor
  - edit text, bold/italic/list controls work visually
  - undo/redo work
  - confirm button disables for empty content
  - confirm send posts the latest edited plain text
  - non-invite emails do not show the reply editor

Suggested implementation approach:

1. Install TipTap packages in `App/`.
2. Build `RichReplyEditor.jsx` as a controlled wrapper around `useEditor` and `EditorContent`.
3. Add helper functions to convert plain text to simple TipTap HTML and TipTap document content back to clean plain text.
4. Update `InviteReplyPanel.jsx` to use `RichReplyEditor`.
5. Add any editor-specific CSS in `App/src/index.css` under a small class namespace, such as `.rich-reply-editor`.
6. Keep `ProgressContext.jsx`, `ProgressView.jsx`, and `apiClient.js` API contracts unchanged unless a real HTML-email backend upgrade is included.
7. Build and verify the progress reply flow.

Acceptance criteria:

- The reply draft panel uses TipTap instead of a textarea.
- Existing AI draft loading still works.
- User edits are preserved and sent through the existing confirm flow.
- The backend still receives `draftText`.
- Empty editor content cannot be sent.
- Toolbar actions work and have active/disabled states.
- No unrelated Progress Tracking behavior regresses.
- `npm run build` succeeds in `App/`.
