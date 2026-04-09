import jwt from "jsonwebtoken";
import crypto from "crypto";
import env from "../config/env.js";

const signAccessToken = (userId) =>
  jwt.sign({ sub: userId, typ: "access" }, env.accessTokenSecret, {
    expiresIn: env.accessTokenTtl,
  });

const signRefreshToken = (userId, sessionId = crypto.randomUUID()) => {
  const token = jwt.sign(
    { sub: userId, sid: sessionId, typ: "refresh" },
    env.refreshTokenSecret,
    {
      expiresIn: env.refreshTokenTtl,
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
