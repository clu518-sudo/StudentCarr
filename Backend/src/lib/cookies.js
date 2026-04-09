import env from "../config/env.js";

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

export { setRefreshCookie, clearRefreshCookie };
