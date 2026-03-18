const env = require("../config/env");
const { setRefreshCookie, clearRefreshCookie } = require("../lib/cookies");
const {
  signupSchema,
  loginSchema,
  validate,
} = require("../validators/auth.schemas");
const authService = require("../services/auth.service");

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

module.exports = {
  signup,
  login,
  refresh,
  logout,
  me,
};
