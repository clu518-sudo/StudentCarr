import prisma from "../lib/prisma.js";

// Demo-deploy guardrails. Every non-admin conversation is capped at a small,
// fixed budget so a public demo can't run up LLM cost on the shared admin
// key (see llmSettings.service.js getEffectiveLlmKey). Admins are exempt
// from all of it.
const DEMO_MESSAGE_LIMIT = 4;
const DEMO_HISTORY_CLEAR_LIMIT = 1;

// ChatThread.usedQuickActions is a JSON-encoded array stored in a single
// string column (SQLite has no array type). Malformed or missing data is
// always treated as "no quick actions used yet" rather than an error.
const parseQuickActions = (raw) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
};

// Records a quick action as used, called only after its turn has completed
// successfully — a failed turn leaves the chip enabled to retry.
const appendQuickAction = async (threadId, quickActionId) => {
  if (!quickActionId) return;

  const thread = await prisma.chatThread.findUnique({
    where: { id: threadId },
    select: { usedQuickActions: true },
  });
  const used = parseQuickActions(thread?.usedQuickActions);
  if (used.includes(quickActionId)) return;

  await prisma.chatThread.update({
    where: { id: threadId },
    data: { usedQuickActions: JSON.stringify([...used, quickActionId]) },
  });
};

// Snapshot of a user's remaining budget for one thread. Admins get
// unlimited: true and the frontend renders no counters or blocks at all.
// threadId may be omitted (no thread exists yet, e.g. a brand-new account
// loading history for the first time) — that reads as a fresh, unused budget.
const getThreadLimits = async ({ user, threadId }) => {
  if (user.role === "admin") {
    return {
      unlimited: true,
      messageLimit: null,
      messagesUsed: 0,
      remaining: null,
      usedQuickActions: [],
      canClearHistory: true,
    };
  }

  if (!threadId) {
    return {
      unlimited: false,
      messageLimit: DEMO_MESSAGE_LIMIT,
      messagesUsed: 0,
      remaining: DEMO_MESSAGE_LIMIT,
      usedQuickActions: [],
      canClearHistory: user.chatHistoryClears < DEMO_HISTORY_CLEAR_LIMIT,
    };
  }

  const [messagesUsed, thread] = await Promise.all([
    prisma.chatMessage.count({ where: { threadId, role: "user" } }),
    prisma.chatThread.findUnique({
      where: { id: threadId },
      select: { usedQuickActions: true },
    }),
  ]);

  return {
    unlimited: false,
    messageLimit: DEMO_MESSAGE_LIMIT,
    messagesUsed,
    remaining: Math.max(0, DEMO_MESSAGE_LIMIT - messagesUsed),
    usedQuickActions: parseQuickActions(thread?.usedQuickActions),
    canClearHistory: user.chatHistoryClears < DEMO_HISTORY_CLEAR_LIMIT,
  };
};

// Rejects a turn before it reaches the paid LLM call — same placement as the
// existing per-user rate limiter (see routes/index.js). Returns null when
// the turn may proceed, or a { statusCode, error, limits } payload to send
// back to the client as-is when it may not.
const checkSendAllowed = async ({ user, threadId, quickActionId }) => {
  const limits = await getThreadLimits({ user, threadId });
  if (limits.unlimited) return null;

  if (quickActionId && limits.usedQuickActions.includes(quickActionId)) {
    return {
      statusCode: 403,
      error: "This quick action has already been used in this conversation.",
      limits,
    };
  }

  if (limits.remaining <= 0) {
    return {
      statusCode: 403,
      error: `Demo limit reached — ${DEMO_MESSAGE_LIMIT} messages per conversation.`,
      limits,
    };
  }

  return null;
};

export {
  DEMO_MESSAGE_LIMIT,
  DEMO_HISTORY_CLEAR_LIMIT,
  parseQuickActions,
  appendQuickAction,
  getThreadLimits,
  checkSendAllowed,
};
