import prisma from "../lib/prisma.js";
import { encryptText, decryptText } from "../lib/crypto.js";

const DEFAULT_PROVIDER = "openai";

const toStatus = (row) => ({
  id: row.id,
  label: row.label,
  provider: row.provider,
  model: row.model,
  baseUrl: row.baseUrl,
  lastFour: row.lastFour,
  isSelected: row.isSelected,
  updatedAt: row.updatedAt,
});

// GET /api/llm-settings
// Never returns the raw or decrypted key — only enough metadata for the
// settings panel to list saved settings and show which one is selected.
const listLlmKeys = async ({ userId }) => {
  const rows = await prisma.userLlmKey.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toStatus);
};

// POST /api/llm-settings
// Encrypts the raw key at rest (AES-256-GCM via FIELD_ENCRYPTION_KEY) and
// creates a new saved setting. The raw key is never stored or logged.
// The first saved setting for a user becomes selected automatically.
const createLlmKey = async ({ userId, label, apiKey, provider, model, baseUrl }) => {
  const encryptedKey = encryptText(apiKey);
  const lastFour = apiKey.slice(-4);

  const existingCount = await prisma.userLlmKey.count({ where: { userId } });

  const row = await prisma.userLlmKey.create({
    data: {
      userId,
      label: label || "Untitled",
      encryptedKey,
      lastFour,
      provider: provider || DEFAULT_PROVIDER,
      model: model || null,
      baseUrl: baseUrl || null,
      isSelected: existingCount === 0,
    },
  });

  return toStatus(row);
};

// POST /api/llm-settings/:id/select
// Marks one saved setting as the active one for this user, deselecting others.
const selectLlmKey = async ({ userId, id }) => {
  const existing = await prisma.userLlmKey.findFirst({ where: { id, userId } });
  if (!existing) {
    const err = new Error("LLM setting not found");
    err.statusCode = 404;
    throw err;
  }

  const [, updated] = await prisma.$transaction([
    prisma.userLlmKey.updateMany({
      where: { userId, NOT: { id } },
      data: { isSelected: false },
    }),
    prisma.userLlmKey.update({
      where: { id },
      data: { isSelected: true },
    }),
  ]);

  return toStatus(updated);
};

// DELETE /api/llm-settings/:id
const deleteLlmKey = async ({ userId, id }) => {
  const deleted = await prisma.userLlmKey.deleteMany({ where: { id, userId } });
  if (deleted.count === 0) {
    const err = new Error("LLM setting not found");
    err.statusCode = 404;
    throw err;
  }
  return { id, deleted: true };
};

// Internal use only (profile generation) — decrypts the user's currently
// selected key so it can be sent to their own LLM provider on their behalf.
// Never expose this over the API.
const getDecryptedLlmKey = async ({ userId }) => {
  const row = await prisma.userLlmKey.findFirst({
    where: { userId, isSelected: true },
  });
  if (!row) {
    return null;
  }

  return {
    apiKey: decryptText(row.encryptedKey),
    provider: row.provider,
    model: row.model,
    baseUrl: row.baseUrl,
  };
};

export {
  listLlmKeys,
  createLlmKey,
  selectLlmKey,
  deleteLlmKey,
  getDecryptedLlmKey,
};
