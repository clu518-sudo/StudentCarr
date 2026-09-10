# MCP Integration for Claude Desktop — Development Task Plan

## Overview

Connect the existing web app (with Gmail OAuth) to Claude Desktop via a personal MCP server. Users generate an API key from the web app, paste an MCP config snippet into Claude Desktop, and Claude gains access to their Gmail through thin stdio-based MCP tooling.

---

## Architecture

```
Web App (Gmail OAuth done)
  → Setup Page: generate API_KEY, show MCP config snippet
  → New API endpoints authenticated by API_KEY
  → Endpoints use that user's Gmail token + LangGraph (AIServices)

MCP Server (stdio, local in Claude Desktop)
  → Thin client — no OAuth, no Gmail logic
  → Forwards tool calls to your API with the API_KEY
```

---

## Phase 1 — API Key System

### 1.1 Database: Prisma schema (`Backend/prisma/schema.prisma`)

- [X] Add `ApiKey` model (example shape):
  - `id`, `hashedKey` (unique), optional `label`, `userId` → `User`, `lastUsedAt`, `revoked`, `createdAt`
- [X] Add `apiKeys ApiKey[]` on `User`
- [X] Run `npx prisma migrate dev`

### 1.2 Backend: key management (`Backend/src/apiKeys/`)

- [X] New module following existing pattern: routes, controller, service
- [X] `POST /api/keys` — create key (use existing JWT `requireAuth`)
- [X] `GET /api/keys` — list user's keys (masked)
- [X] `DELETE /api/keys/:id` — revoke
- [X] Key format: `sc_` + high-entropy secret; store **hashed** only; return plaintext **once** on create
- [X] Register in `Backend/src/routes/index.js`, e.g. `router.use("/keys", requireAuth, apiKeyRoutes)`

### 1.3 Backend: API key middleware (`Backend/src/middleware/apiKeyAuth.middleware.js`)

- [X] Read `Authorization: Bearer sc_...`
- [X] Hash lookup key, `prisma.apiKey.findUnique`, ensure not `revoked`
- [X] Set `req.user` / `userId` for downstream handlers
- [X] Update `lastUsedAt`
- [X] `401` if missing/invalid/revoked

---

## Phase 2 — MCP API endpoint (existing Backend)

**Align with your “recent page” single entry: one backend route that runs the same track as `processTrack`.**

### 2.1 `POST /api/mcp/process-tracking`

- [X] Add route in `Backend/src/mcp/mpc.routes.js` and mount with `router.use("/mcp", mcpRoutes)` in `Backend/src/routes/index.js`
- [X] Authenticate with **`requireApiKeyAuth`** (no JWT session required for MCP clients)
- [X] Body: `{ message: string }` validated by `Backend/src/mcp/mcp.schemas.js`
- [X] Current command behavior: `message === "getEmails"` triggers sync + application/email aggregation (`runProgressTracking` in `Backend/src/mcp/mcp.service.js`)
- [X] Resolve user context via `req.user.id` from API key middleware and use process-tracking services (including sync pipeline)
- [X] Response shape: `{ success: true, data: { sync, emails } }` on success; validation returns `400` with `{ success: false, error }`

### 2.2 Error handling

- [ ] `401` — invalid/missing API key
- [ ] `403` — Gmail not connected or token unusable (point user to web app to reconnect)
- [ ] `429` — per-key rate limit (extend `rateLimit.middleware.js` if needed)
- [ ] `500` — safe message; log details server-side only

---

## Phase 3 — Setup page (frontend `App/`)

### 3.1 “Connect to Claude Desktop”

- [X] Visible after Gmail OAuth is complete
- [X] “Generate API key” → `POST /api/keys` → show key once + copy button
- [X] Warning: save the key; it will not be shown again
- [X] List keys (masked), dates, revoke

### 3.2 MCP config snippet

- [X] Paste-ready Claude Desktop config, e.g.:

```json
{
  "mcpServers": {
    "studentcarr-gmail": {
      "command": "npx",
      "args": ["-y", "studentcarr-mcp-server"],
      "env": {
        "STUDENTCARR_API_KEY": "sc_YOUR_KEY_HERE",
        "STUDENTCARR_API_URL": "https://your-api-host"
      }
    }
  }
}
```

- [X] Copy buttons; link to where Claude Desktop stores MCP config

---

## Phase 4 — MCP server package (stdio)

### 4.1 Project

- [X] New package `mcp-server/` (or publishable name), `bin` for CLI
- [X] `@modelcontextprotocol/sdk`; TypeScript optional
- [X] Env: `STUDENTCARR_API_KEY`, `STUDENTCARR_API_URL`

### 4.2 Single tool

- [x] Tool name e.g. `process_track`
- [X] Description: send Gmail-related requests to StudentCarr
- [X] Input: `{ message: string }`
- [X] `POST {STUDENTCARR_API_URL}/api/process-tracking/mcp` with `Authorization: Bearer <key>`

### 4.3 MCP server errors

- [X] Map `401` / `403` to clear tool errors (regenerate key / reconnect Gmail)
- [X] Network failures: short retry guidance

---

## Phase 5 — Testing and hardening

Tested by user.

- [ ] Unit tests: key generation, hashing, lookup, revoke
- [ ] Integration: `/api/process-tracking/mcp` with valid/invalid keys
- [ ] E2E: MCP Inspector, then Claude Desktop
- [ ] Security: keys hashed at rest, not logged, HTTPS in production

---

## Phase 6 — Publish and docs

- [ ] Publish npm package (e.g. `studentcarr-mcp-server`); verify `npx` works
- [ ] README + in-app troubleshooting

---

## File structure (expected changes)

```
StudentCarr/
├── Backend/
│   ├── prisma/schema.prisma                 ← ApiKey model
│   └── src/
│       ├── routes/index.js                  ← mount /api/keys
│       ├── middleware/apiKeyAuth.middleware.js
│       ├── apiKeys/                         ← new
│       └── processTracking/
│           ├── processTracking.routes.js
│           ├── processTracking.controller.js
│           └── processTracking.service.js
├── App/
│   └── src/…                                ← Setup / MCP UI
├── mcp-server/                              ← new package
└── TASK-MCP-Integration.md                  ← this file
```

---

## Implementation order

1. Phase 1 — API keys (Prisma + routes + middleware)
2. Phase 2 — `POST /api/process-tracking/mcp` wired to AIServices like `processTrack`
3. Phase 3 — Setup UI and snippet
4. Phase 4 — MCP stdio package
5. Phase 5 — Tests and limits
6. Phase 6 — Publish and docs
