import crypto from "crypto";
import prisma from "../lib/prisma.js";

const KEY_PREFIX = "sc_";
const KEY_RANDOM_BYTES = 32; // 32 random bytes => 64 hex chars. 1 bytes = 8 bites 1 hex = 4 bites.

// Function used to
// Convert raw API key -> SHA-256 hash (hex string).
// We store this hash in DB (never raw key) for security.
const hashApiKey = (rawKey) =>
  crypto.createHash("sha256").update(rawKey).digest("hex");

// Function used to
// Generate raw key in required format: sc_ + 32-byte random hex.
const generateRawApiKey = () => {
  const randomHex = crypto.randomBytes(KEY_RANDOM_BYTES).toString("hex");
  return `${KEY_PREFIX}${randomHex}`;
};

// For GET response "masked" display.
// Since raw key is never stored, we can only show a safe hint.
// real raw api only show once when generate.
const maskApiHashForDisplay = (hashedKey) =>
  `${KEY_PREFIX}****************${hashedKey.slice(-4)}`;

// POST /api/keys
// - generates one key
// - stores only hash
// - returns raw key ONCE
const createApiKey = async ({ userId, label }) => {
  const rawKey = generateRawApiKey();
  const hashedKey = hashApiKey(rawKey);

  const created = await prisma.apiKey.create({
    data: {
      userId,
      label: label?.trim() || null,
      hashedKey,
      revoked: false,
    },
    select: {
      id: true,
      label: true,
      createdAt: true,
    },
  });

  return {
    id: created.id,
    label: created.label,
    createdAt: created.createdAt,
    key: rawKey,
  };
};

// GET /api/keys
// - list only active (not revoked) keys for current user
// - return masked preview, never raw/hashed key
const listActiveApiKeys = async ({ userId }) => {
  const rows = await prisma.apiKey.findMany({
    where: {
      userId,
      revoked: false,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      label: true,
      lastUsedAt: true,
      createdAt: true,
      hashedKey: true, // only used to derive safe preview, not return directly
    },
  });

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
    maskedKey: maskApiHashForDisplay(row.hashedKey),
  }));
};

// DELETE /api/keys/:id
// - soft revoke key by setting revoked=true
// - scoped by userId so user can only revoke own keys
const revokeApiKey = async ({ userId, keyId }) => {
  const updated = await prisma.apiKey.updateMany({
    where: {
      id: keyId,
      userId,
      revoked: false,
    },
    data: {
      revoked: true,
    },
  });

  if (updated.count === 0) {
    const err = new Error("API key not find or already revoked");
    err.statusCode = 404;
    throw err;
  }

  return { id: keyId, revoked: true };
};

export { createApiKey, listActiveApiKeys, revokeApiKey, hashApiKey };
