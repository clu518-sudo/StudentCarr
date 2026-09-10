# Implementation Prompt — In-App Chatbot with MCP Tools

Use this file to drive the implementation. Work **one phase at a time**: paste the
[Base Prompt](#base-prompt) plus exactly one [Phase Prompt](#phase-prompts) into the agent,
verify the exit criteria yourself, then move to the next phase.

Do **not** paste all phases at once. Each phase exists to de-risk the next one, and the
verification steps in between are the point.

---

## Base Prompt

> Copy this section verbatim at the start of every phase request.

```
You are implementing an in-app AI chatbot for the StudentCarr project that uses MCP
(Model Context Protocol) tools to access the app's own functionality — architecturally
similar to how Claude web calls MCP tools.

READ FIRST
Read `MCP_CHATBOT_PLAN.md` in the repository root. It is the authoritative specification:
architecture, design decisions, module layout, phases, and exit criteria. Follow it. If you
believe something in the plan is wrong or infeasible, STOP and explain the problem instead of
silently deviating.

PROJECT CONTEXT
Monorepo with four services:
  - `App/`        (port 10003) React + Vite frontend
  - `Backend/`    (port 10001) Express + Prisma API — the MCP GATEWAY (auth + business logic)
  - `AIServices/` (port 10002) TypeScript service — already runs LangGraph + OpenAI; becomes
                                the MCP HOST (owns the agent loop)
  - `mcp-server/` (port 10004) MCP server — becomes a standalone stateless HTTP service

ARCHITECTURE IN ONE PARAGRAPH
Three tiers, not two. `Backend` is a thin auth gateway: it authenticates the user
(`requireAuth`), mints a short-lived scoped MCP token, rate-limits, and forwards one chat turn
to `AIServices`. `AIServices` is the MCP Host: it runs the LLM agent loop using LangGraph
(`createAgent` from the `langchain` package — the same LangGraph runtime already used by
`generate_user_infomation.ts`, via the loop implementation LangChain now ships under `langchain`
rather than `@langchain/langgraph/prebuilt`'s deprecated `createReactAgent`; see the Phase 4
prompt for the version note) and holds the MCP client (`@langchain/mcp-adapters`
`MultiServerMCPClient`, HTTP transport). It connects to `mcp-server`, which publishes tools and
executes them by calling back into the Backend's REST API using the forwarded scoped token.
The browser only ever talks to Backend; it never reaches `AIServices` or `mcp-server` directly.
Claude Desktop is OUT OF SCOPE.

NON-NEGOTIABLE CONSTRAINTS
1. The MCP server runs STATELESS Streamable HTTP. No session IDs, no per-user in-memory
   state. This is required for horizontal scaling behind a load balancer.
2. The MCP server contains ZERO business logic and ZERO database access. It is a tool
   catalog plus protocol adapter; handlers make thin HTTP calls to the Backend.
3. `userId` is derived ONLY from a verified token. It must NEVER appear in a tool input
   schema where an LLM could supply it.
4. The LLM API key lives ONLY in `AIServices` environment config. It must never be added to
   Backend's env or sent to the browser.
5. `AIServices` stays a STATELESS compute tier: no Prisma client, no direct database access,
   no per-user in-memory store beyond the short-lived MCP-client cache (§4.4 of the plan).
   Backend remains the single source of truth for data, permissions, and domain rules, and the
   only service that verifies the user's login JWT.
6. Do not restructure `App/src/components/layout/CareerChatbot.jsx`. It was written with a
   single integration seam — `requestAssistantReply(userText)`. Change that function (and add
   error handling); leave the rest of the component alone. The component sends ONLY the
   message text — no page/section context, no `buildContext()` step. Do not reintroduce one;
   see plan §4.6. If a tool built in a later round needs to know "what the user is looking at",
   that is resolved server-side via MCP, never by adding a client-computed payload field.
7. Match existing project conventions: the `{ success, data }` / `{ success, error }` response
   envelope, zod schemas in `*.schemas.js`, the `index.js`-re-exports-router module pattern,
   the `apiRequest(path, options, token)` helper in `App/src/lib/apiClient.js`, and the
   existing unauthenticated-loopback convention Backend already uses to call `AIServices`
   (`pt.service.js`'s `AI_BASE_URL` / `requestAiService()` — no new internal auth mechanism).
8. Do not add narration comments. Comment only non-obvious intent or constraints.
9. Do not delete the API-key / Claude Desktop code in early phases. Retirement is handled
   separately (see section 10 of the plan).

WORKING AGREEMENT
- Implement ONLY the phase named in the request below. Do not jump ahead.
- Before editing, read the existing files you are about to change.
- After implementing, run any lints/tests that apply and fix what you introduced.
- Finish with: what changed (file by file), how to verify it manually, and any deviation
  from the plan with your reasoning.
- If a required decision is not yet made (e.g. LLM provider), ask rather than assuming.
```

---

## Phase Prompts

Append one of these to the Base Prompt.

### Phase 1 — Transport swap (stdio → stateless HTTP)

```
IMPLEMENT PHASE 1 of MCP_CHATBOT_PLAN.md — convert `mcp-server` from a stdio subprocess into
a standalone stateless Streamable HTTP service on port 10004.

Scope:
- Extract server construction into `mcp-server/src/server.js` as `buildServer()`, registering
  the ListTools/CallTool handlers and returning an UNCONNECTED server. Transport choice must
  move out of it.
- Add `mcp-server/src/http.js`: HTTP listener exposing `POST /mcp` via the SDK's Streamable
  HTTP server transport in STATELESS mode, plus `GET /health`.
- Rewrite `mcp-server/src/index.js` as the HTTP bootstrap. Remove the boot-time
  STUDENTCARR_API_KEY / STUDENTCARR_API_URL hard-exit — auth now arrives per request, and the
  API base URL becomes ordinary config (default http://127.0.0.1:10001).
- Listen on MCP_PORT (default 10004), bind MCP_HOST (default 127.0.0.1).
- Update `mcp-server/package.json`: description, start/dev scripts. Drop the `bin` entry.
- Add a fourth service line to `start-all-services.bat`.
- Add `MCP_SERVER_URL` to `AIServices`'s env (default http://127.0.0.1:10004) — NOT Backend's.
  It is `AIServices`'s MCP client (Phase 5) that calls `mcp-server` directly; Backend never
  talks to `mcp-server`.

Leave tool handlers and auth alone — that is Phase 2. `process_track` may still be broken
end-to-end at this point; it only needs to be LISTABLE.

Exit criteria to demonstrate:
- `GET http://127.0.0.1:10004/health` returns OK.
- MCP Inspector connects over HTTP and lists `process_track`.
- Two sequential listTools calls succeed with NO session ID (proving statelessness).
```

### Phase 2 — Scoped MCP token auth

```
IMPLEMENT PHASE 2 of MCP_CHATBOT_PLAN.md — replace the long-lived `sc_` API key with a
short-lived scoped JWT, minted by Backend and forwarded through AIServices to mcp-server.

Token design (section 4.3 of the plan):
  claims: { sub: <userId>, typ: "mcp", aud: "studentcarr-mcp", iat, exp }
  secret: env.mcpTokenSecret (separate from access/refresh secrets)
  TTL:    ~2 minutes

Scope:
- Add `mcpTokenSecret` and `mcpTokenTtl` to `Backend/src/config/env.js`.
- Add `Backend/src/chat/mcpToken.js` with signMcpToken/verifyMcpToken, following the style of
  `Backend/src/lib/token.js`.
- Add `Backend/src/middleware/mcpTokenAuth.middleware.js`: verify signature, reject any token
  whose `typ` is not "mcp", set `req.user = { id: payload.sub }`.
- Switch `Backend/src/mcp/mpc.routes.js` from `requireApiKeyAuth` to the new middleware.
- In `mcp-server`, read the incoming `Authorization` header per request and thread it through
  to tool handlers via the request context.
- In `mcp-server/src/apiClient.js`, forward that token instead of reading
  process.env.STUDENTCARR_API_KEY. Keep the status-code → friendly-message mapping, but
  update the 401 text (it must no longer tell users to generate a key in the web app).

Note: `AIServices` does not verify this token in this phase (it doesn't exist as a caller of
mcp-server yet — that's Phase 5). For now, mint and verify it purely within Backend/mcp-server
to prove the mechanism, e.g. by minting a token manually for MCP Inspector testing.

Security requirements:
- userId must come only from the verified token, never from tool arguments.
- Verify no tool input schema accepts a user identifier.

Exit criteria to demonstrate:
- With a manually minted token, an MCP Inspector callTool on `process_track` executes as the
  correct user and returns real data, with no `sc_` key anywhere in the path.
- A missing, expired, or wrong-`typ` token is rejected with 401.
```

### Phase 3 — Chat endpoint skeleton (no AI, no AIServices)

```
IMPLEMENT PHASE 3 of MCP_CHATBOT_PLAN.md — wire the frontend to a real backend chat endpoint
with NO LLM involved yet. The point is to prove auth, routing, CORS, and the frontend seam in
isolation. This phase stays entirely inside Backend — do not touch `AIServices`.

Scope:
- Create `Backend/src/chat/` with index.js, chat.routes.js, chat.controller.js,
  chat.schemas.js (zod, matching the `mcp.schemas.js` convention).
- Mount in `Backend/src/routes/index.js`: router.use("/chat", requireAuth, chatRoutes)
- POST /api/chat accepts { message } (no context field — see plan §4.6) and returns
  { success: true, data: { reply: "<hardcoded string>" } }.
- Add `chatApi.send(body, token)` to `App/src/lib/apiClient.js` using the existing
  apiRequest helper.
- In `App/src/components/layout/CareerChatbot.jsx`, replace ONLY the body of
  `requestAssistantReply(userText)` so it calls chatApi.send with the user's access token and
  `{ message: userText }`. Add error handling so a failed request renders an error message in
  the transcript rather than leaving the panel stuck.

Do NOT add an LLM, MCP client, AIServices call, or streaming in this phase.

Exit criteria to demonstrate:
- Typing in the chat panel round-trips through the Backend with the correct req.user.id.
- The hardcoded reply renders in the UI.
- A 401 (e.g. expired token) surfaces as a visible message, not a silent hang.
```

### Phase 4 — LLM in the loop in AIServices, no tools

```
IMPLEMENT PHASE 4 of MCP_CHATBOT_PLAN.md — add the LLM agent, running in AIServices, with an
EMPTY tool list. Backend becomes a thin proxy to it.

AIServices already has `@langchain/langgraph` and `@langchain/openai` installed and a working
model-client setup in `AIServices/src/generate_user_infomation.ts` (OPENAI_MODEL,
OPENAI_API_KEY, OPENAI_BASE_URL). Reuse that configuration pattern — do not add a provider
package or an LLM API key to Backend.

DEPENDENCY NOTE: the plan originally named `createReactAgent` from
`@langchain/langgraph/prebuilt` as the agent loop. Check the installed
`@langchain/langgraph` version's types before writing agent.service.ts — if
`createReactAgent` is marked `@deprecated` in favor of `createAgent` from a separate
`langchain` package (true as of `@langchain/langgraph@^1.0.0`), use `createAgent` instead;
its `llm`/`tools`/`prompt` params and `.invoke({ messages })` return shape are the same, so
it is a near drop-in swap. This means adding `langchain` to `AIServices/package.json` in this
phase — pin a version whose `peerDependencies` accept the installed `@langchain/core` (run
`npm view langchain@<version> peerDependencies` to check; e.g. `@langchain/core@^1.1.48`
needs `langchain@^1.1.x`–`^1.4.x`, not `^1.5.x` which requires `@langchain/core@^1.2.9`).
If `createReactAgent` is NOT deprecated in the installed version, skip this and use it as
originally planned — confirm which case applies before proceeding either way.

Scope:
- `AIServices/src/chat/agent.service.ts`: `createAgent({ llm, tools: [] })` (or
  `createReactAgent` — see the dependency note above for which one applies), using a
  `ChatOpenAI` instance built the same way `generate_user_infomation.ts` builds one.
- Add `POST /chat/turn` to `AIServices/src/server.ts`, following the existing raw-`http`
  `parseRequestBody`/`writeJson` pattern used by the other routes there (`/generate-profile`,
  `/progress-tracking/sync`, etc). Accepts `{ message }`, returns
  `{ success: true, data: { reply } }`.
- Build the system prompt in AIServices from a brief, static description of what StudentCarr is
  and what the assistant is for. Do NOT add a context/currentSection/path field anywhere in this
  phase — the frontend does not send one (plan §4.6); page-awareness is deferred to a later
  round as an MCP tool.
- `Backend/src/chat/aiServiceClient.js`: a thin fetch wrapper calling
  `${env.progressTrackingServiceBaseUrl}/chat/turn` — reuse this existing config value, do not
  add a new "AI service URL" env var. Mirror `pt.service.js`'s `requestAiService()` helper
  (same unauthenticated-loopback convention, no new internal auth).
- Wire `Backend/src/chat/chat.controller.js` to call `aiServiceClient` instead of returning the
  hardcoded string from Phase 3.

Before starting, confirm the LLM provider and model with me if not already decided (they may
already be set via AIServices's existing OPENAI_* env vars).

Exit criteria to demonstrate:
- A genuine conversational reply appears in the chat panel, round-tripping through
  Backend → AIServices and back, for a page-agnostic question (e.g. "how should I structure
  my resume?"). Page-awareness is out of scope for this phase (plan §4.6).
```

### Phase 5 — Connect the agent to MCP (milestone)

```
IMPLEMENT PHASE 5 of MCP_CHATBOT_PLAN.md — give the AIServices agent real MCP tools. This is
the milestone phase.

Scope:
- Add `@langchain/mcp-adapters` to `AIServices/package.json` (the only new dependency this
  phase needs — Phase 4 may already have added `langchain` itself, see its dependency note).
- Add `AIServices/src/chat/mcpClient.service.ts` building a MultiServerMCPClient:

    studentcarr: {
      transport: "http",
      url: `${env.MCP_SERVER_URL}/mcp`,
      headers: { Authorization: `Bearer ${scopedToken}` },
    }

  where `scopedToken` arrives in the `/chat/turn` request body — Backend mints it (Phase 2
  helper, from req.user.id), AIServices only forwards it and never verifies it.
- IMPORTANT: MultiServerMCPClient sets headers at CONSTRUCTION time, so a per-user token
  requires a per-user client. Implement a small cache keyed by userId whose entries expire
  slightly before the token does, and call close() on eviction. Do not use a global singleton.
  This cache lives in AIServices, not Backend.
- Update `Backend/src/chat/chat.controller.js` / `aiServiceClient.js` to mint the scoped token
  per chat request and include it in the payload sent to AIServices.
- Load tools with getTools() and pass them into createAgent (or createReactAgent — whichever
  Phase 4 ended up using).
- Cap the loop with a max-steps / recursion limit (CHAT_MAX_STEPS, forwarded from Backend or
  mirrored in AIServices's own env) so a confused model cannot loop indefinitely.

Exit criteria to demonstrate:
- Asking "show me my latest job application emails" triggers a real getEmails execution
  (visible in Backend AND AIServices logs across all three hops) and yields an answer grounded
  in actual data.
- A second turn in the same conversation still works after the first token has expired.
- Confirm Backend never calls mcp-server directly — only AIServices does.
```

### Phase 6 — Grow the tool catalog properly

```
IMPLEMENT PHASE 6 of MCP_CHATBOT_PLAN.md — restructure tools for a growing catalog. This phase
is about Backend's MCP-facing REST surface and mcp-server's tool registry; it is unaffected by
which service hosts the agent.

Read the Phase 6 section of the plan carefully — it was REVISED after reading the current
code, and it corrects two things earlier drafts got wrong. Problem A is already half-solved,
and getEmailsHandler does NOT sync.

PROBLEM A — the free-text tag dispatcher.
`process_track` posts { message: "getEmails" } to POST /api/mcp and routes through
MESSAGE_HANDLER (mcp.service.js:117-130) — a one-entry router duplicating what Express
already does. One coarse tool also covers the whole progress-tracking domain, with no way to
ask for a single application, a single email, or a filtered subset.

  Already done, do NOT redo: `get_user_profile` (mcp-server/src/tools/getProfile.js) already
  implements the target pattern — its own route POST /api/mcp/profile, never touching the
  dispatcher. Copy that structure. Also, the magic string is already hidden from the model
  (processTrack.js:6 hardcodes ROUTING_TAG, inputSchema is empty), so do not spend effort on
  "stop the LLM picking the wrong tag" — that failure mode is gone.

  - Build the catalog in the plan's Phase 6 table: list_applications,
    list_application_emails, get_email_detail (plus the untouched get_user_profile).
  - Write each description FOR A MODEL: when to use it, what it returns.
  - One Backend route per tool, then DELETE MESSAGE_HANDLER, mcpDispatcher,
    mcpDispatcherSchema, and POST /api/mcp outright. Verified safe:
    mcp-server/src/tools/processTrack.js:21 is the only caller in the repo.
  - Do NOT add a sync_mailbox tool. The catalog stays read-only; sync is side-effecting and
    belongs behind Phase 9's approval gates. See the plan.

PROBLEM B — response size will overflow the context window.
getEmailsHandler fans out to getEmailDetailById per email, and each result's `body` is
toMessageBody = rawBodyHtml || rawBodyText || snippet (pt.service.js:120) — raw HTML wins
whenever it exists — plus a full `replies` array whose entries each carry their own raw HTML
body. The cost is emails × thread depth, paid in markup rather than prose.

  THE FIX IS SUMMARY-FIRST. List tools return NO message body at all. They return the stored
  AI-derived fields instead: summary, intent, companyName, positionTitle, contactEmail,
  alongside sender, subject, date, replyCount.

  This is safe because pt.service.js:606-638 upserts a ProgressEmailIntelligence row for
  EVERY persisted email, unconditionally, in the same transaction as the email record. But
  `summary` is String? (schema.prisma:390) and can be null when extraction produced nothing —
  fall back to `snippet`, NEVER to rawBodyHtml.

  - Pagination (limit default 20, max 50; cursor) and filters (applicationId, intent).
  - get_email_detail is the ONLY path that returns a body, one email at a time, with every
    body (root and each reply) HTML-stripped AND quoted-chain-trimmed.
  - Add listEmailSummariesForUser to pt.service.js — listEmailsForApplication requires an
    applicationId and cannot serve the unfiltered case. Include the trailing { id: "asc" }
    ordering tiebreaker; cursor pagination is unstable without it. This also removes the N+1.
  - Add stripQuotedChain beside the existing stripHtml in mcp.service.js.

SECURITY: applicationId and emailId ARE legitimate tool arguments, but every query using them
must stay scoped by userId (as listEmailsForApplication and getEmailDetailById already are),
so a guessed or hallucinated id cannot reach another user's row. No tool input schema may
contain a user identifier.

Confirm with me before implementing:
- The per-response token budget. The plan proposes ~6k tokens; I have not committed to it.
- Whether get_email_detail ships at all, or whether this round exposes no message bodies.

Also settle the page/section-context question deferred in plan §4.6: decide (with me) whether
"what is the user currently looking at" becomes its own tool (e.g. `get_current_context`) or is
folded into other tools' descriptions, and implement whichever is chosen. Still undecided.

Exit criteria to demonstrate:
- At least two distinct tools exist and the model reliably picks the right one
  ("which jobs did I apply to?" -> list_applications; "what did Acme say?" ->
  list_application_emails).
- No list-tool response contains a raw HTML body.
- No single tool response exceeds the agreed token budget, measured on a real account with
  the largest thread available.
- MESSAGE_HANDLER and POST /api/mcp no longer exist anywhere in the repo.
```

### Phase 7 — Conversation memory

```
IMPLEMENT PHASE 7 of MCP_CHATBOT_PLAN.md — multi-turn memory.

CareerChatbot currently holds messages in React state and sends a single turn.

Constraint: AIServices must stay a stateless compute tier (Base Prompt constraint #5). It must
not gain its own database or its own notion of "threads." If persisted history is chosen,
Backend remains the store — it loads recent history and includes it in each `/chat/turn`
request to AIServices, rather than AIServices fetching or storing it itself.

Recommended approach (confirm with me first): persist threads in Backend's Prisma database
keyed by threadId, so history survives refresh AND any Backend or AIServices replica can serve
any turn — which matters for the scaling goal. The alternative is client-sent history (simpler,
no migration).

REQUIRED, whichever storage option is chosen — DO NOT REPLAY TOOL RESULTS.
Persist and replay ONLY the human messages and each turn's final assistant text (the message
with no tool_calls). Drop every tool call and every tool result from stored history.

Why: tool results are snapshots of tables that keep changing, but replayed into context they
read as facts. On a later turn the model sees it already "knows" the user's applications, skips
the tool call, and answers from data captured several turns ago — after a sync may have changed
it. Do NOT try to solve this with a prompt instruction telling the model to re-call the tool;
that relies on exactly the model judgment Phase 6 assumes is unreliable. Removing the stale data
from context IS the mechanism: with no cached rows to reuse, the only route to application data
is a fresh tool call.

Note this bug does not exist yet — runChatTurn currently passes only
`[new HumanMessage(message)]`, so every turn starts blank and always re-calls. It is introduced
by the obvious implementation of this phase.

GOTCHA: never persist an AIMessage carrying tool_calls without its matching tool-result message
— the replayed history is malformed and the provider rejects the request. Storing one human
message plus one final text reply per turn avoids this by construction.

Add this system-prompt line as a BACKSTOP ONLY, not as the mechanism: "Earlier turns do not
contain live data. Whenever a question depends on the user's applications or emails, call the
tool again rather than relying on anything stated earlier."

Scope depends on the choice; if persisting, include the Prisma schema change and migration
(in Backend only).

Exit criteria to demonstrate:
- A follow-up like "summarize the second one" resolves correctly against the previous turn.
- History survives a page refresh (if persisting).
- A value changed directly in the database between two turns is reflected in the second answer,
  proving the model re-called the tool instead of reusing a replayed result.
```

### Phase 8 — Streaming

```
IMPLEMENT PHASE 8 of MCP_CHATBOT_PLAN.md — stream responses over SSE, across the two internal
hops (AIServices → Backend → browser).

Follow the EXISTING precedent for framing, but note it does NOT provide token-level
granularity out of the box: `profileManagementApi.generateManualProfileStream` in
`App/src/lib/apiClient.js` performs POST-with-token SSE using `streamSseResponse` from
`App/src/lib/sseClient.js`, and `Backend/src/profileManagement/pm.controller.js` writes SSE via
`initSseHeaders`/`sendSseEvent` from `Backend/src/events/sse.js` — but those emit coarse
`started`/`progress`/`completed` status messages, not incremental LLM tokens. Reuse the SSE
transport/framing conventions; the chat stream itself must carry actual token deltas.

Scope:
- `AIServices` exposes `POST /chat/stream`, using the LangGraph agent's streaming API
  (e.g. `.streamEvents()`) to emit SSE: token deltas plus tool-status events
  (tool_start / tool_end) so the UI can show e.g. "Checking your application emails…".
- Backend adds `POST /api/chat/stream` that PROXIES the AIServices stream through to the
  browser — it reads AIServices's SSE response (Node's native `fetch` supports
  `response.body.getReader()` the same way the browser does) and re-emits each event via
  `sendSseEvent`, rather than regenerating or buffering the whole reply.
- In CareerChatbot.jsx, replace the isThinking placeholder with incremental rendering.
  Keep the component's structure intact.

Exit criteria to demonstrate:
- Tokens render progressively in the browser.
- Tool activity is visible in the UI while it is happening.
- The Backend→browser leg still works even though it is now proxying an upstream stream rather
  than generating events itself.
```

### Phase 9 — Hardening and scale readiness

```
IMPLEMENT PHASE 9 of MCP_CHATBOT_PLAN.md — production hardening across all three services.

Scope:
- Loop safety: max tool-call steps, per-tool timeout, overall request timeout — including a
  timeout on Backend's call to AIServices, separate from AIServices's own per-tool timeout.
- Per-user rate limiting on /api/chat using `Backend/src/middleware/rateLimit.middleware.js`,
  enforced BEFORE Backend calls AIServices. LLM calls cost real money — this is required, not
  optional, and rejecting early avoids paying for requests that will be discarded.
- Error surfacing: tool failures should return a clear message TO THE MODEL so it can recover
  or explain, rather than throwing and killing the turn. Use the existing 401/403 mapping in
  `mcp-server/src/apiClient.js` as the template.
- HTTP keep-alive / connection reuse on BOTH internal hops: Backend → AIServices and
  AIServices → mcp-server.
- Load-balancer readiness: `/health` already exists on AIServices; add/confirm it on the MCP
  service too. Graceful shutdown draining in-flight requests on both.
- Tracing: propagate a request ID from /api/chat → AIServices → mcp-server → Backend REST, so
  a single tool call can be traced across all FOUR hops.
- Propose (do not yet build) an approval-gate pattern for future side-effecting tools such as
  sending an email — note `sendInviteReply` already exists in AIServices.

Exit criteria to demonstrate:
- A deliberately failing tool produces a graceful assistant explanation, not a 500.
- Rate limiting triggers as expected, before AIServices is ever called.
- A request ID can be followed through all four services' logs (Backend, AIServices,
  mcp-server, and back to Backend).
```

---

## Optional: retirement pass

Run only after Phase 5 is proven and you are certain Claude Desktop support will not return.

```
Perform the retirement described in section 10 of MCP_CHATBOT_PLAN.md.

Remove or unlink the now-unused Claude Desktop / API-key surface:
  - Backend/src/apiKeys/** and the /api/keys mount
  - Backend/src/middleware/apiKeyAuth.middleware.js
  - App/src/components/mcp/McpSetupView.jsx plus its route and sidebar entry
  - apiKeysApi in App/src/lib/apiClient.js
  - user_guide/MCP_USER_GUIDE.md
  - .mcpb bundle generation and the `bin` entry in mcp-server/package.json

Do NOT touch these — they are actively reused as tool implementations:
  - Backend/src/mcp/mcp.service.js (runService and handlers)
  - Backend/src/processTracking/pt.service.js
  - mcp-server/src/tools/**
  - mcp-server/src/apiClient.js

Default to UNLINKING (remove from navigation/routing) rather than deleting, unless I
explicitly say to delete. Confirm the Prisma ApiKey model's fate with me before any migration.
```
