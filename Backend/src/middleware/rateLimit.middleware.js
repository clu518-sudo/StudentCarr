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

export { loginRateLimit, signupRateLimit, chatRateLimit };
