import prisma from "../lib/prisma.js";
import env from "../config/env.js";

const MAX_TITLE_LENGTH = 60;

const buildTitle = (message) => {
  const text = message.trim().replace(/\s+/g, " ");
  return text.length > MAX_TITLE_LENGTH
    ? `${text.slice(0, MAX_TITLE_LENGTH - 1)}…`
    : text;
};

// Scoped by userId, so a guessed or stale threadId can never reach another
// user's thread — it just starts a fresh one, and the caller adopts the new id
// from the response.
const resolveThread = async ({ userId, threadId, firstMessage }) => {
  if (threadId) {
    const existing = await prisma.chatThread.findFirst({
      where: { id: threadId, userId },
      select: { id: true },
    });
    if (existing) return existing;
  }

  return prisma.chatThread.create({
    data: { userId, title: buildTitle(firstMessage) },
    select: { id: true },
  });
};

const loadRecentHistory = async (threadId) => {
  const rows = await prisma.chatMessage.findMany({
    where: { threadId },
    orderBy: { id: "desc" },
    take: Math.max(1, env.chatHistoryTurns) * 2,
    select: { role: true, content: true },
  });
  return rows.reverse();
};

const appendTurn = ({ threadId, userMessage, assistantReply }) =>
  prisma.$transaction([
    prisma.chatMessage.createMany({
      data: [
        { threadId, role: "user", content: userMessage },
        { threadId, role: "assistant", content: assistantReply },
      ],
    }),
    prisma.chatThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    }),
  ]);

const getLatestThreadWithMessages = async (userId) => {
  const thread = await prisma.chatThread.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!thread) return { threadId: null, messages: [] };

  const messages = await prisma.chatMessage.findMany({
    where: { threadId: thread.id },
    orderBy: { id: "desc" },
    take: Math.max(1, env.chatHistoryTurns) * 2,
    select: { role: true, content: true, createdAt: true },
  });

  return { threadId: thread.id, messages: messages.reverse() };
};

// Wipes every thread belonging to one user — backs the "clear history" button.
// Messages are deleted explicitly rather than left to the FK cascade so the
// result does not depend on SQLite's foreign_keys pragma being enabled.
// For non-admins this also bumps chatHistoryClears in the same transaction,
// so the demo's one-time-clear limit (chatLimits.js) can never diverge from
// whether the wipe actually happened.
const deleteChatHistory = ({ id: userId, role }) =>
  prisma.$transaction([
    prisma.chatMessage.deleteMany({ where: { thread: { userId } } }),
    prisma.chatThread.deleteMany({ where: { userId } }),
    ...(role === "admin"
      ? []
      : [
          prisma.user.update({
            where: { id: userId },
            data: { chatHistoryClears: { increment: 1 } },
          }),
        ]),
  ]);

// Called on every login (not signup, and not a silent token refresh — see
// createAuthResult in auth.service.js) for non-admin users: wipes previous
// chat threads so each login starts a brand-new dialog, and resets
// chatHistoryClears to 0 so the one-time "clear history" allowance
// (chatLimits.js) renews each login too, instead of being a lifetime cap.
const resetChatSessionForUser = (userId) =>
  prisma.$transaction([
    prisma.chatMessage.deleteMany({ where: { thread: { userId } } }),
    prisma.chatThread.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { chatHistoryClears: 0 } }),
  ]);

export {
  resolveThread,
  loadRecentHistory,
  appendTurn,
  getLatestThreadWithMessages,
  deleteChatHistory,
  resetChatSessionForUser,
};
