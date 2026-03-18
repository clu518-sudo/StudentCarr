const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const env = require("../config/env");

const signAccessToken = (userId) =>
  jwt.sign({ sub: userId, typ: "access" }, env.accessTokenSecret, {
    expiresIn: env.accessTokenTtl,
  });

const signRefreshToken = (userId, sessionId = crypto.randomUUID()) => {
  const token = jwt.sign({ sub: userId, sid: sessionId, typ: "refresh" }, env.refreshTokenSecret, {
    expiresIn: env.refreshTokenTtl,
  });
  return { token, sessionId };
};

const verifyAccessToken = (token) =>
  jwt.verify(token, env.accessTokenSecret, { ignoreExpiration: false });

const verifyRefreshToken = (token) =>
  jwt.verify(token, env.refreshTokenSecret, { ignoreExpiration: false });

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
