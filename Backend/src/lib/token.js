import jwt from "jsonwebtoken";
import crypto from "crypto";
import env from "../config/env.js";

// ttlOverride lets a caller shorten a token's lifetime for a specific case
// (see auth.service.js's NORMAL_USER_SESSION_TTL) without touching the
// app-wide defaults in env.js.
const signAccessToken = (userId, ttlOverride) =>
  jwt.sign({ sub: userId, typ: "access" }, env.accessTokenSecret, {
    expiresIn: ttlOverride || env.accessTokenTtl,
  });

const signRefreshToken = (userId, sessionId = crypto.randomUUID(), ttlOverride) => {
  const token = jwt.sign(
    { sub: userId, sid: sessionId, typ: "refresh" },
    env.refreshTokenSecret,
    {
      expiresIn: ttlOverride || env.refreshTokenTtl,
    },
  );
  return { token, sessionId };
};

const verifyAccessToken = (token) =>
  jwt.verify(token, env.accessTokenSecret, { ignoreExpiration: false });

const verifyRefreshToken = (token) =>
  jwt.verify(token, env.refreshTokenSecret, { ignoreExpiration: false });

export {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
