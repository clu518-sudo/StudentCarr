import argon2 from "argon2";
import env from "../config/env.js";
import prisma from "../lib/prisma.js";
import { encryptText, generateOpaqueToken, hashValue } from "../lib/crypto.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/token.js";
import { getFreshGmailAccessContextForUser } from "../processTracking/pt.gmail.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const GOOGLE_LOGIN_SCOPE_LIST = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const createHttpError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const assertGoogleLoginConfigured = () => {
  if (
    !env.googleLoginClientId ||
    !env.googleLoginClientSecret ||
    !env.googleLoginRedirectUri
  ) {
    throw createHttpError(
      "Google login is not configured. Set GOOGLE_LOGIN_CLIENT_ID, GOOGLE_LOGIN_CLIENT_SECRET, and GOOGLE_LOGIN_REDIRECT_URI.",
      500,
    );
  }
};

const fetchJson = async (url, options, fallbackMessage) => {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createHttpError(
      payload?.error_description || payload?.error || fallbackMessage,
      502,
    );
  }
  return payload;
};

const exchangeCodeForTokens = async (code) => {
  const body = new URLSearchParams({
    code,
    client_id: env.googleLoginClientId,
    client_secret: env.googleLoginClientSecret,
    redirect_uri: env.googleLoginRedirectUri,
    grant_type: "authorization_code",
  });

  return fetchJson(
    GOOGLE_TOKEN_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
    "Failed to exchange Google OAuth code.",
  );
};

const fetchGoogleUserInfo = async (accessToken) =>
  fetchJson(
    GOOGLE_USERINFO_URL,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    "Failed to verify Google account identity.",
  );

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
  authProvider: user.authProvider,
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

const createAuthResult = async (user, req, eventType, metadata = null) => {
  const accessToken = signAccessToken(user.id);
  const { token: refreshToken, sessionId } = signRefreshToken(user.id);
  await createSession(user.id, refreshToken, sessionId, req);
  await writeAudit(eventType, user.id, metadata);

  return {
    user: toSafeUser(user),
    accessToken,
    refreshToken,
  };
};

const upsertGmailAccountForGoogleLogin = async (tx, user, tokens, userInfo) => {
  const existingAccount = await tx.gmailAccount.findUnique({
    where: { userId: user.id },
  });
  const accessToken = tokens.access_token || "";
  const googleEmail = normalizeEmail(userInfo.email) || user.email;
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + Number(tokens.expires_in) * 1000)
    : existingAccount?.expiresAt || null;
  const refreshToken = tokens.refresh_token || "";
  const fallbackRefreshToken = existingAccount?.refreshTokenEncrypted
    ? existingAccount.refreshTokenEncrypted
    : null;

  const account = await tx.gmailAccount.upsert({
    where: { userId: user.id },
    update: {
      googleSub: String(userInfo.id || existingAccount?.googleSub || ""),
      googleEmail,
      displayName: userInfo.name || existingAccount?.displayName || null,
      scope:
        typeof tokens.scope === "string"
          ? tokens.scope
          : existingAccount?.scope || GOOGLE_LOGIN_SCOPE_LIST.join(" "),
      accessTokenEncrypted: accessToken ? encryptText(accessToken) : null,
      refreshTokenEncrypted: refreshToken
        ? encryptText(refreshToken)
        : fallbackRefreshToken,
      tokenType: tokens.token_type || existingAccount?.tokenType || "Bearer",
      expiresAt,
      connectedAt: existingAccount?.connectedAt || new Date(),
      lastVerifiedAt: new Date(),
      isActive: true,
    },
    create: {
      userId: user.id,
      googleSub: String(userInfo.id || googleEmail),
      googleEmail,
      displayName: userInfo.name || null,
      scope:
        typeof tokens.scope === "string"
          ? tokens.scope
          : GOOGLE_LOGIN_SCOPE_LIST.join(" "),
      accessTokenEncrypted: accessToken ? encryptText(accessToken) : null,
      refreshTokenEncrypted: refreshToken ? encryptText(refreshToken) : null,
      tokenType: tokens.token_type || "Bearer",
      expiresAt,
      lastVerifiedAt: new Date(),
      isActive: true,
    },
    select: { id: true },
  });

  await tx.gmailSyncState.upsert({
    where: { gmailAccountId: account.id },
    update: {},
    create: { gmailAccountId: account.id },
  });
};

// the service of signup
const signup = async ({ email, password, fullName }, req) => {
  const normalizedEmail = normalizeEmail(email);
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
      authProvider: "password",
      fullName: fullName || null,
    },
  });

  return createAuthResult(user, req, "signup_success", { email: normalizedEmail });
};

// the service of login
const login = async ({ email, password }, req) => {
  const normalizedEmail = normalizeEmail(email);
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

  const isValidPassword =
    typeof user.passwordHash === "string" &&
    user.passwordHash.length > 0 &&
    (await argon2.verify(user.passwordHash, password));
  if (!isValidPassword) {
    await writeAudit("login_failed", user.id, {
      email: normalizedEmail,
      reason: "invalid_password",
    });
    const err = new Error("Invalid email or password");
    err.statusCode = 401;
    throw err;
  }

  const userForSession =
    user.authProvider === "password"
      ? user
      : await prisma.user.update({
          where: { id: user.id },
          data: { authProvider: "password" },
        });
  return createAuthResult(userForSession, req, "login_success", {
    email: normalizedEmail,
  });
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

  if (session.user?.authProvider === "google") {
    try {
      await getFreshGmailAccessContextForUser(session.userId);
    } catch (error) {
      const revokedAt = new Date();
      await prisma.$transaction(async (tx) => {
        await tx.authSession.updateMany({
          where: {
            userId: session.userId,
            revokedAt: null,
          },
          data: { revokedAt },
        });

        await tx.gmailAccount.updateMany({
          where: { userId: session.userId },
          data: {
            isActive: false,
            accessTokenEncrypted: null,
            refreshTokenEncrypted: null,
            expiresAt: null,
          },
        });
      });

      await writeAudit("refresh_failed_google_expired", session.userId, {
        reason: error instanceof Error ? error.message : "google_session_invalid",
      });

      const err = new Error("Google session expired. Please sign in with Google again.");
      err.statusCode = 401;
      throw err;
    }
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

const startGoogleLogin = async () => {
  assertGoogleLoginConfigured();

  const state = generateOpaqueToken();
  const stateHash = hashValue(state);
  await prisma.authOAuthState.create({
    data: {
      stateHash,
      expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS),
    },
  });

  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set("client_id", env.googleLoginClientId);
  authUrl.searchParams.set("redirect_uri", env.googleLoginRedirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("scope", GOOGLE_LOGIN_SCOPE_LIST.join(" "));
  authUrl.searchParams.set("state", state);

  return {
    authUrl: authUrl.toString(),
  };
};

const completeGoogleLogin = async ({ code, state, error }, req) => {
  if (error) {
    throw createHttpError(String(error), 400);
  }

  if (!code || !state) {
    throw createHttpError("Missing Google OAuth code or state.", 400);
  }

  assertGoogleLoginConfigured();

  const stateHash = hashValue(String(state));
  const oauthState = await prisma.authOAuthState.findUnique({
    where: { stateHash },
  });
  if (!oauthState || oauthState.expiresAt.getTime() < Date.now()) {
    throw createHttpError("Google login session expired.", 400);
  }

  try {
    const tokens = await exchangeCodeForTokens(String(code));
    const accessToken = tokens.access_token || "";
    if (!accessToken) {
      throw createHttpError("Google login did not return an access token.", 502);
    }

    const googleUserInfo = await fetchGoogleUserInfo(accessToken);
    const googleEmail = normalizeEmail(googleUserInfo.email);
    const googleSub = String(googleUserInfo.id || "").trim();
    if (!googleEmail) {
      throw createHttpError("Google account email is unavailable.", 502);
    }
    if (!googleSub) {
      throw createHttpError("Google account subject is unavailable.", 502);
    }

    const userByGoogleSub = await prisma.user.findUnique({
      where: { googleSub },
    });
    const userByEmail = await prisma.user.findUnique({
      where: { email: googleEmail },
    });
    if (userByGoogleSub && userByEmail && userByGoogleSub.id !== userByEmail.id) {
      throw createHttpError(
        "This Google account is already linked to a different user.",
        409,
      );
    }

    const existingUser = userByGoogleSub || userByEmail;

    const user = await prisma.$transaction(async (tx) => {
      const userRecord = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              email: googleEmail,
              authProvider: "google",
              googleSub: String(googleSub || existingUser.googleSub || ""),
              fullName: existingUser.fullName || googleUserInfo.name || null,
              isEmailVerified: true,
            },
          })
        : await tx.user.create({
            data: {
              email: googleEmail,
              passwordHash: await argon2.hash(generateOpaqueToken(), {
                type: argon2.argon2id,
                memoryCost: 19456,
                timeCost: 2,
                parallelism: 1,
              }),
              authProvider: "google",
              googleSub: String(googleSub || googleEmail),
              fullName: googleUserInfo.name || null,
              isEmailVerified: true,
            },
          });

      await upsertGmailAccountForGoogleLogin(tx, userRecord, tokens, googleUserInfo);
      return userRecord;
    });

    return createAuthResult(user, req, "login_success_google", {
      email: googleEmail,
    });
  } finally {
    await prisma.authOAuthState.deleteMany({
      where: { id: oauthState.id },
    });
  }
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

export {
  signup,
  login,
  startGoogleLogin,
  completeGoogleLogin,
  refreshSession,
  logout,
};
