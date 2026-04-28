import env from "../config/env.js";
import prisma from "../lib/prisma.js";
import {
  decryptText,
  encryptText,
  generateOpaqueToken,
  hashValue,
} from "../lib/crypto.js";

const GMAIL_SCOPE_LIST = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const createHttpError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getFrontendProgressUrl = (status, message = "") => {
  const baseUrl = String(
    env.appBaseUrl || env.corsOrigin || "http://localhost:10000",
  )
    .split(",")[0]
    .trim();
  const url = new URL("/progress", baseUrl);
  url.searchParams.set("gmail", status);
  if (message) {
    url.searchParams.set("message", message);
  }
  return url.toString();
};

const assertGmailOauthConfigured = () => {
  if (!env.gmailClientId || !env.gmailClientSecret || !env.gmailRedirectUri) {
    throw createHttpError(
      "Gmail OAuth is not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REDIRECT_URI.",
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
    client_id: env.gmailClientId,
    client_secret: env.gmailClientSecret,
    redirect_uri: env.gmailRedirectUri,
    grant_type: "authorization_code",
  });

  return fetchJson(
    GOOGLE_TOKEN_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
    "Failed to exchange Gmail OAuth code.",
  );
};

const refreshAccessToken = async (refreshToken) => {
  const body = new URLSearchParams({
    client_id: env.gmailClientId,
    client_secret: env.gmailClientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  return fetchJson(
    GOOGLE_TOKEN_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
    "Failed to refresh Gmail access token.",
  );
};

const fetchGoogleUserInfo = async (accessToken) =>
  fetchJson(
    GOOGLE_USERINFO_URL,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    "Failed to verify Gmail account identity.",
  );

const mapGmailStatus = (account) => ({
  connected: Boolean(account?.isActive),
  email: account?.googleEmail || "",
  displayName: account?.displayName || "",
  lastVerifiedAt: account?.lastVerifiedAt || null,
  lastSyncedAt: account?.lastSyncedAt || null,
  requiresReconnect:
    Boolean(account) &&
    !account?.refreshTokenEncrypted &&
    (!account?.accessTokenEncrypted || !account?.expiresAt),
  sync: account?.syncState
    ? {
        status: account.syncState.lastSyncStatus,
        lastSyncStartedAt: account.syncState.lastSyncStartedAt,
        lastSyncCompletedAt: account.syncState.lastSyncCompletedAt,
        lastSyncError: account.syncState.lastSyncError,
        firstSyncCompletedAt: account.syncState.firstSyncCompletedAt,
      }
    : null,
});

const getGmailStatusForUser = async (userId) => {
  const account = await prisma.gmailAccount.findUnique({
    where: { userId },
    include: { syncState: true },
  });

  return {
    gmail: mapGmailStatus(account),
  };
};

const createGmailConnectUrlForUser = async (user) => {
  assertGmailOauthConfigured();

  const state = generateOpaqueToken();
  const stateHash = hashValue(state);
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS);

  await prisma.gmailOAuthState.create({
    data: {
      userId: user.id,
      stateHash,
      expiresAt,
    },
  });

  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set("client_id", env.gmailClientId);
  authUrl.searchParams.set("redirect_uri", env.gmailRedirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("scope", GMAIL_SCOPE_LIST.join(" "));
  authUrl.searchParams.set("state", state);
  if (user.email) {
    authUrl.searchParams.set("login_hint", user.email);
  }

  return {
    authUrl: authUrl.toString(),
  };
};

const handleGmailOAuthCallback = async ({ code, state, error: oauthError }) => {
  if (oauthError) {
    return { redirectUrl: getFrontendProgressUrl("error", String(oauthError)) };
  }

  if (!code || !state) {
    return {
      redirectUrl: getFrontendProgressUrl(
        "error",
        "Missing Gmail OAuth code or state.",
      ),
    };
  }

  assertGmailOauthConfigured();

  const stateHash = hashValue(state);
  const oauthState = await prisma.gmailOAuthState.findUnique({
    where: { stateHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  if (!oauthState || oauthState.expiresAt.getTime() < Date.now()) {
    return {
      redirectUrl: getFrontendProgressUrl(
        "error",
        "Gmail OAuth session expired.",
      ),
    };
  }

  try {
    const tokens = await exchangeCodeForTokens(String(code));
    const accessToken = tokens.access_token || "";
    if (!accessToken) {
      throw createHttpError("Gmail OAuth did not return an access token.", 502);
    }

    const userInfo = await fetchGoogleUserInfo(accessToken);
    const appEmail = normalizeEmail(oauthState.user.email);
    const googleEmail = normalizeEmail(userInfo.email);

    if (!googleEmail) {
      throw createHttpError(
        "Unable to verify the connected Gmail address.",
        502,
      );
    }

    if (appEmail && googleEmail !== appEmail) {
      throw createHttpError(
        `Connected Gmail account ${googleEmail} does not match the signed-in account ${appEmail}.`,
        400,
      );
    }

    const existingAccount = await prisma.gmailAccount.findUnique({
      where: { userId: oauthState.userId },
    });

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + Number(tokens.expires_in) * 1000)
      : existingAccount?.expiresAt || null;

    await prisma.$transaction(async (tx) => {
      await tx.gmailAccount.upsert({
        where: { userId: oauthState.userId },
        update: {
          googleSub: String(userInfo.id || existingAccount?.googleSub || ""),
          googleEmail,
          displayName: userInfo.name || existingAccount?.displayName || null,
          scope:
            typeof tokens.scope === "string"
              ? tokens.scope
              : existingAccount?.scope,
          accessTokenEncrypted: encryptText(accessToken),
          refreshTokenEncrypted: encryptText(
            tokens.refresh_token ||
              (existingAccount?.refreshTokenEncrypted
                ? decryptText(existingAccount.refreshTokenEncrypted)
                : ""),
          ),
          tokenType: tokens.token_type || existingAccount?.tokenType || null,
          expiresAt,
          connectedAt: existingAccount?.connectedAt || new Date(),
          lastVerifiedAt: new Date(),
          isActive: true,
        },
        create: {
          userId: oauthState.userId,
          googleSub: String(userInfo.id || googleEmail),
          googleEmail,
          displayName: userInfo.name || null,
          scope:
            typeof tokens.scope === "string"
              ? tokens.scope
              : GMAIL_SCOPE_LIST.join(" "),
          accessTokenEncrypted: encryptText(accessToken),
          refreshTokenEncrypted: encryptText(tokens.refresh_token || ""),
          tokenType: tokens.token_type || "Bearer",
          expiresAt,
          lastVerifiedAt: new Date(),
          isActive: true,
        },
      });

      const account = await tx.gmailAccount.findUnique({
        where: { userId: oauthState.userId },
        select: { id: true },
      });

      await tx.gmailSyncState.upsert({
        where: { gmailAccountId: account.id },
        update: {},
        create: { gmailAccountId: account.id },
      });

      await tx.gmailOAuthState.delete({
        where: { id: oauthState.id },
      });
    });

    return {
      redirectUrl: getFrontendProgressUrl("connected"),
    };
  } catch (error) {
    await prisma.gmailOAuthState
      .delete({
        where: { id: oauthState.id },
      })
      .catch(() => {});

    return {
      redirectUrl: getFrontendProgressUrl(
        "error",
        error instanceof Error ? error.message : "Gmail OAuth failed.",
      ),
    };
  }
};

const disconnectGmailAccountForUser = async (userId) => {
  const account = await prisma.gmailAccount.findUnique({
    where: { userId },
  });

  if (!account) {
    return {
      gmail: mapGmailStatus(null),
    };
  }

  await prisma.gmailAccount.update({
    where: { userId },
    data: {
      isActive: false,
      accessTokenEncrypted: null,
      refreshTokenEncrypted: null,
      expiresAt: null,
    },
  });

  const refreshed = await prisma.gmailAccount.findUnique({
    where: { userId },
    include: { syncState: true },
  });

  return {
    gmail: mapGmailStatus(refreshed),
  };
};

const getFreshGmailAccessContextForUser = async (userId) => {
  const account = await prisma.gmailAccount.findUnique({
    where: { userId },
    include: { syncState: true },
  });

  if (!account || !account.isActive) {
    throw createHttpError("Gmail account is not connected.", 400);
  }

  const now = Date.now();
  const currentAccessToken = account.accessTokenEncrypted
    ? decryptText(account.accessTokenEncrypted)
    : "";
  const refreshTokenValue = account.refreshTokenEncrypted
    ? decryptText(account.refreshTokenEncrypted)
    : "";
  const shouldRefresh =
    !currentAccessToken ||
    !account.expiresAt ||
    account.expiresAt.getTime() <= now + ACCESS_TOKEN_REFRESH_BUFFER_MS;

  if (!shouldRefresh) {
    return {
      account,
      syncState: account.syncState,
      accessToken: currentAccessToken,
    };
  }

  if (!refreshTokenValue) {
    throw createHttpError(
      "Gmail connection needs to be re-authorized before syncing.",
      400,
    );
  }

  const refreshedTokens = await refreshAccessToken(refreshTokenValue);
  const accessToken = refreshedTokens.access_token || "";
  if (!accessToken) {
    throw createHttpError("Failed to refresh Gmail access token.", 502);
  }

  const updatedAccount = await prisma.gmailAccount.update({
    where: { id: account.id },
    data: {
      accessTokenEncrypted: encryptText(accessToken),
      tokenType: refreshedTokens.token_type || account.tokenType || "Bearer",
      expiresAt: refreshedTokens.expires_in
        ? new Date(Date.now() + Number(refreshedTokens.expires_in) * 1000)
        : account.expiresAt,
      isActive: true,
      lastVerifiedAt: new Date(),
    },
    include: { syncState: true },
  });

  return {
    account: updatedAccount,
    syncState: updatedAccount.syncState,
    accessToken,
  };
};

export {
  GMAIL_SCOPE_LIST,
  createGmailConnectUrlForUser,
  disconnectGmailAccountForUser,
  getFreshGmailAccessContextForUser,
  getGmailStatusForUser,
  getFrontendProgressUrl,
  handleGmailOAuthCallback,
};
