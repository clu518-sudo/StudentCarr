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

export { resolveThread, loadRecentHistory, appendTurn, getLatestThreadWithMessages };
