import env from "../config/env.js";
import { setRefreshCookie, clearRefreshCookie } from "../lib/cookies.js";
import {
  signupSchema,
  loginSchema,
  validate,
} from "../validators/auth.schemas.js";
import * as authService from "../services/auth.service.js";

/*
Handling the error thrown by Zod
Mock error.issue:
[
  {
    code: "invalid_string",
    validation: "email",
    path: ["email"],
    message: "Invalid email"
  },
  {
    code: "too_small",
    minimum: 8,
    type: "string",
    inclusive: true,
    path: ["password"],
    message: "String must contain at least 8 character(s)"
  }
] 
*/
const formatZodError = (error) => {
  if (!error?.issues) {
    return "Invalid request payload";
  }

  return error.issues
    .map((issue) => `${issue.path.join(".") || "field"}: ${issue.message}`)
    .join(", ");
};

const getFrontendAuthUrl = (path, message = "") => {
  const baseUrl = String(env.appBaseUrl || env.corsOrigin || "http://localhost:10003")
    .split(",")[0]
    .trim();
  const redirectUrl = new URL(path, baseUrl);
  if (message) {
    redirectUrl.searchParams.set("message", message);
  }
  return redirectUrl.toString();
};

// implement signup
const signup = async (req, res, next) => {
  try {
    const payload = validate(signupSchema, req.body);
    const result = await authService.signup(payload, req);
    setRefreshCookie(res, result.refreshToken);

    return res.status(201).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    if (error.name === "ZodError") {
      return res
        .status(400)
        .json({ success: false, error: formatZodError(error) });
    }
    return next(error); // passes error to global error handler.
  }
};

// implementation of login
const login = async (req, res, next) => {
  try {
    const payload = validate(loginSchema, req.body);
    const result = await authService.login(payload, req);
    setRefreshCookie(res, result.refreshToken);

    return res.json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    if (error.name === "ZodError") {
      return res
        .status(400)
        .json({ success: false, error: formatZodError(error) });
    }
    return next(error);
  }
};

const startGoogleLogin = async (req, res, next) => {
  try {
    const result = await authService.startGoogleLogin();
    return res.json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const googleCallback = async (req, res) => {
  try {
    const result = await authService.completeGoogleLogin(req.query || {}, req);
    setRefreshCookie(res, result.refreshToken);
    return res.redirect(getFrontendAuthUrl("/dashboard"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google login failed.";
    return res.redirect(getFrontendAuthUrl("/login", message));
  }
};

// when access token expired, refresh access token and refresh token at the same time, recent refresh token as verification key.
const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[env.refreshCookieName];
    const result = await authService.refreshSession(refreshToken, req);
    setRefreshCookie(res, result.refreshToken);

    return res.json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// logout the user, remove refresh token from cookie
const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[env.refreshCookieName];
    await authService.logout(refreshToken);
    clearRefreshCookie(res);

    return res.json({ success: true, data: { message: "Logged out" } });
  } catch (error) {
    return next(error);
  }
};

const me = async (req, res) =>
  res.json({
    success: true,
    data: {
      user: req.user,
    },
  });

export { signup, login, startGoogleLogin, googleCallback, refresh, logout, me };
