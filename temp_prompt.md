# Task

Implement an asynchronous PDF document parsing workflow for the existing application.

# Background

The application already has a document upload interface. Users upload files through the frontend, and the backend should parse uploaded PDF documents into plain text, store the parsed text in the database, and make it available for later use.

# Requirements

1. Reuse the existing document upload interface and backend upload flow.
2. After a PDF is uploaded, start parsing it asynchronously so the upload request is not blocked by long-running parsing work.
3. Notify the frontend when parsing finishes, including success and failure states.
4. Use LangChain for document loading/parsing orchestration.
5. Extract embedded text from the PDF first.
6. If embedded text extraction fails or returns insufficient text, fall back to OCR.
7. Save the parsed plain text to the database and associate it with the uploaded document and user.
8. When the user deletes the document from the frontend, delete the related parsed text and any parser metadata from the database as well.
9. Track parser status in the database, such as `pending`, `processing`, `completed`, and `failed`.
10. Store useful parser metadata, such as page count, extraction method, error message, created time, and updated time.

# Implementation Guidance

Inspect the existing upload API, document model/schema, frontend upload UI, and deletion flow before making changes. Follow the existing project patterns for routing, database access, background jobs, state management, and notifications.

Use LangChain document loaders where appropriate for the initial PDF text extraction. For OCR fallback, use a practical OCR library or service that fits the existing stack. Keep OCR isolated behind a small adapter so it can be replaced later.

The parser should be resilient:

- Do not crash the upload flow if parsing fails.
- Mark failed parses clearly in the database.
- Return or push enough status information for the frontend to show progress or failure.
- Avoid parsing unsupported file types unless the app already supports them.
- Handle large PDFs without loading unnecessary data into memory.

# Frontend Behavior

Update the frontend so users can see the parsing state after upload. The UI should reflect at least:

- Upload received / parsing pending
- Parsing in progress
- Parsing completed
- Parsing failed

Use the app's existing notification or realtime mechanism if one exists. If not, implement the smallest appropriate polling or status-refresh flow.

# Database Behavior

Add or update database tables/models as needed to store parsed text and parser status. Parsed text must be linked to the uploaded document record. Deleting a document must also delete its parsed text and parsing metadata, either through application logic or database cascade behavior.

# Acceptance Criteria

- Uploading a PDF creates a document record and queues asynchronous parsing.
- The parser first attempts normal PDF text extraction.
- OCR is used only when normal extraction is unavailable or insufficient.
- Parsed plain text is persisted in the database.
- The frontend is notified or updated when parsing completes or fails.
- Deleting a document also deletes the parsed text and parser metadata.
- Parser failures are stored and visible to the frontend.
- Existing upload and delete behavior continues to work.
- Relevant tests are added or updated for upload, parsing status, persistence, OCR fallback, and deletion cleanup.

# Deliverables

- Backend async parsing implementation.
- LangChain-based PDF parsing integration.
- OCR fallback integration.
- Database schema/model updates.
- Frontend parsing status updates.
- Tests or documented verification steps.
