const env = require("../config/env");

const refreshCookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? "strict" : "lax",
  path: "/api/auth",
};

const setRefreshCookie = (res, token) => {
  res.cookie(env.refreshCookieName, token, refreshCookieOptions);
};

const clearRefreshCookie = (res) => {
  res.clearCookie(env.refreshCookieName, refreshCookieOptions);
};

module.exports = {
  setRefreshCookie,
  clearRefreshCookie,
};
