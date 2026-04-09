import argon2 from "argon2";
import prisma from "../lib/prisma.js";
import { hashValue } from "../lib/crypto.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/token.js";

/*
collect user-agent info and ip(need to hash)
*/
const buildSessionMeta = (req) => ({
  deviceInfo: req.get("user-agent") || null,
  ipHash: req.ip ? hashValue(req.ip) : null,
});

/*
collect user info
*/
const toSafeUser = (user) => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  isEmailVerified: user.isEmailVerified,
  createdAt: user.createdAt,
});

/*
  save refresh token into backend database. 
  function description:
  when access token expired, the frontend will call /auth/refresh with refresh token.
   ↓
  backend verify refresh token saved in database, if pass return new access token.
*/
const createSession = async (userId, refreshToken, sessionId, req) => {
  const decoded = verifyRefreshToken(refreshToken);
  const sessionMeta = buildSessionMeta(req);

  await prisma.authSession.create({
    data: {
      id: sessionId,
      userId,
      refreshTokenHash: hashValue(refreshToken),
      deviceInfo: sessionMeta.deviceInfo,
      ipHash: sessionMeta.ipHash,
      expiresAt: new Date(decoded.exp * 1000),
    },
  });
};

// Audit the API call
const writeAudit = async (eventType, userId, metadata) => {
  await prisma.authAuditLog.create({
    data: {
      userId: userId || null,
      eventType,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
};

// the service of signup
const signup = async ({ email, password, fullName }, req) => {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    const err = new Error("Email is already registered");
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      fullName: fullName || null,
    },
  });

  const accessToken = signAccessToken(user.id);
  const { token: refreshToken, sessionId } = signRefreshToken(user.id);
  await createSession(user.id, refreshToken, sessionId, req);
  await writeAudit("signup_success", user.id, { email: normalizedEmail });

  return {
    user: toSafeUser(user),
    accessToken,
    refreshToken,
  };
};

// the service of login
const login = async ({ email, password }, req) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    await writeAudit("login_failed", null, {
      email: normalizedEmail,
      reason: "user_not_found",
    });
    const err = new Error("Invalid email or password");
    err.statusCode = 401;
    throw err;
  }

  const isValidPassword = await argon2.verify(user.passwordHash, password);
  if (!isValidPassword) {
    await writeAudit("login_failed", user.id, {
      email: normalizedEmail,
      reason: "invalid_password",
    });
    const err = new Error("Invalid email or password");
    err.statusCode = 401;
    throw err;
  }

  const accessToken = signAccessToken(user.id);
  const { token: refreshToken, sessionId } = signRefreshToken(user.id);
  await createSession(user.id, refreshToken, sessionId, req);
  await writeAudit("login_success", user.id, { email: normalizedEmail });

  return {
    user: toSafeUser(user),
    accessToken,
    refreshToken,
  };
};

const refreshSession = async (refreshToken, req) => {
  if (!refreshToken) {
    const err = new Error("Missing refresh token");
    err.statusCode = 401;
    throw err;
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    const err = new Error("Invalid refresh token");
    err.statusCode = 401;
    throw err;
  }

  const session = await prisma.authSession.findUnique({
    where: { id: payload.sid },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    const err = new Error("Refresh token has expired or is revoked");
    err.statusCode = 401;
    throw err;
  }

  if (session.refreshTokenHash !== hashValue(refreshToken)) {
    const err = new Error("Refresh token mismatch");
    err.statusCode = 401;
    throw err;
  }

  await prisma.authSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  const accessToken = signAccessToken(session.userId);
  const { token: nextRefreshToken, sessionId: nextSessionId } =
    signRefreshToken(session.userId);
  await createSession(session.userId, nextRefreshToken, nextSessionId, req);

  await writeAudit("refresh_success", session.userId, {
    previousSessionId: session.id,
  });

  return {
    user: toSafeUser(session.user),
    accessToken,
    refreshToken: nextRefreshToken,
  };
};

const logout = async (refreshToken) => {
  if (!refreshToken) {
    return;
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    await prisma.authSession.updateMany({
      where: { id: payload.sid, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await writeAudit("logout", payload.sub, { sessionId: payload.sid });
  } catch {
    // Invalid token should not break logout UX.
  }
};

export { signup, login, refreshSession, logout };
