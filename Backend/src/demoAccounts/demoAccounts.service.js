// Self-service "Create demo account" backend — POST /api/demo-account
// (public, rate-limited; see demoAccounts.routes.js). Generates a throwaway
// normal-user account, seeds it with the exact same demo data every demo
// account gets (src/demoData/demoData.service.js — the same content
// scripts/seed-demo-data.js injects for a named user), and schedules the
// whole account for deletion after DEMO_ACCOUNT_TTL_MS. That's a real
// account lifecycle, not just a session timeout: the login session itself
// is already capped for every normal user (see auth.service.js's
// NORMAL_USER_SESSION_TTL), and both happen to be 10 minutes.
import crypto from "crypto";
import prisma from "../lib/prisma.js";
import { hashPassword } from "../lib/password.js";
import { removeFileSafe } from "../profileManagement/pm.storage.js";
import { seedDemoDataForUser } from "../demoData/demoData.service.js";

const DEMO_ACCOUNT_TTL_MS = 10 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 30 * 1000;
const MAX_CREATE_ATTEMPTS = 5;

const randomToken = (bytes) => crypto.randomBytes(bytes).toString("hex");

// Different account name and password per demo user, same demo content for
// all of them (that content lives in demoData.service.js).
const generateDemoCredentials = () => ({
  email: `demo-${randomToken(5)}@studentcarr.demo`,
  password: `Demo-${randomToken(6)}!`,
});

const isUniqueConstraintError = (error) => error?.code === "P2002";

// Creates one throwaway demo account and seeds it. Retries on the
// astronomically unlikely case of a random-email collision.
const createDemoAccount = async () => {
  let user = null;
  let credentials = null;

  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS && !user; attempt += 1) {
    credentials = generateDemoCredentials();
    try {
      user = await prisma.user.create({
        data: {
          email: credentials.email,
          passwordHash: await hashPassword(credentials.password),
          authProvider: "password",
          fullName: "Demo Account",
          isEmailVerified: true,
          role: "user",
          isDemo: true,
          demoExpiresAt: new Date(Date.now() + DEMO_ACCOUNT_TTL_MS),
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      // Collided with an existing email — loop and try a fresh one.
    }
  }

  if (!user) {
    const err = new Error("Could not allocate a demo account. Please try again.");
    err.statusCode = 500;
    throw err;
  }

  await seedDemoDataForUser(user);

  return {
    email: credentials.email,
    password: credentials.password,
    expiresAt: user.demoExpiresAt,
  };
};

// Deletes one demo account: the physical resume file first (its
// ProfileDocument row has no separate cleanup once the user cascades away),
// then ApiKey rows (no onDelete rule, same as scripts/create-user.js
// --delete), then the user itself — cascading everything else.
const deleteDemoAccount = async (userId) => {
  const documents = await prisma.profileDocument.findMany({
    where: { userId },
    select: { path: true },
  });
  await Promise.all(documents.map((doc) => removeFileSafe(doc.path)));
  await prisma.apiKey.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
};

// Deletes every demo account past its demoExpiresAt. Run on a recurring
// interval (see startDemoAccountCleanupLoop) rather than one setTimeout per
// account — simpler, and self-heals within one interval tick after a server
// restart instead of losing scheduled timers.
const cleanupExpiredDemoAccounts = async () => {
  const expired = await prisma.user.findMany({
    where: { isDemo: true, demoExpiresAt: { lte: new Date() } },
    select: { id: true },
  });

  for (const { id } of expired) {
    await deleteDemoAccount(id).catch((error) => {
      console.error(`Failed to clean up expired demo account ${id}:`, error.message);
    });
  }

  return expired.length;
};

let cleanupTimer = null;

// Called once at server boot (see server.js) — an immediate sweep catches
// anything left over from a previous run (e.g. the server restarted mid
// window), then a recurring sweep keeps up with new expirations.
const startDemoAccountCleanupLoop = () => {
  cleanupExpiredDemoAccounts()
    .then((count) => {
      if (count > 0) {
        console.log(`Cleaned up ${count} leftover demo account(s) on boot`);
      }
    })
    .catch((error) => {
      console.error("Initial demo account cleanup sweep failed:", error.message);
    });

  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    cleanupExpiredDemoAccounts().catch((error) => {
      console.error("Demo account cleanup sweep failed:", error.message);
    });
  }, CLEANUP_INTERVAL_MS);
  // Don't hold the process open just for this timer.
  cleanupTimer.unref?.();
};

export {
  DEMO_ACCOUNT_TTL_MS,
  createDemoAccount,
  deleteDemoAccount,
  cleanupExpiredDemoAccounts,
  startDemoAccountCleanupLoop,
};
