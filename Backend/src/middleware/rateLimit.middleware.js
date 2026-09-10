import { RateLimiterMemory } from "rate-limiter-flexible";
import env from "../config/env.js";

const loginLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60 * 15,
});

const signupLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60 * 15,
});

// Per-user, not per-IP: each turn costs real LLM money, so the key must
// survive requireAuth having already run (chatRateLimit is mounted after it).
const chatLimiter = new RateLimiterMemory({
  points: env.chatRateLimitPoints,
  duration: env.chatRateLimitDurationSeconds,
});

// Global, not per-IP or per-user: "in 10 mins only 10 demo user can be
// created" is a shared budget across every visitor, protecting the admin's
// shared LLM key and the demo DB from being flooded from many IPs at once.
const demoAccountLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60 * 10,
});
const DEMO_ACCOUNT_RATE_LIMIT_KEY = "global";

const createRateLimitMiddleware = (limiter, keyBuilder) => async (req, res, next) => {
  try {
    const key = keyBuilder(req);
    await limiter.consume(key);
    return next();
  } catch {
    return res.status(429).json({
      success: false,
      error: "Too many attempts. Please try again later.",
    });
  }
};

const loginRateLimit = createRateLimitMiddleware(
  loginLimiter,
  (req) => `${req.ip}:${String(req.body?.email || "").toLowerCase()}`,
);

const signupRateLimit = createRateLimitMiddleware(signupLimiter, (req) => req.ip);

const chatRateLimit = createRateLimitMiddleware(chatLimiter, (req) => req.user.id);

// Admins are exempt — requires optionalAuth to have run first so req.user is
// populated when a valid admin token is present (see demoAccounts.routes.js).
const demoAccountRateLimit = async (req, res, next) => {
  if (req.user?.role === "admin") {
    return next();
  }
  try {
    await demoAccountLimiter.consume(DEMO_ACCOUNT_RATE_LIMIT_KEY);
    return next();
  } catch {
    return res.status(429).json({
      success: false,
      error: "Demo account limit reached. Please try again in a few minutes.",
    });
  }
};

export { loginRateLimit, signupRateLimit, chatRateLimit, demoAccountRateLimit };
