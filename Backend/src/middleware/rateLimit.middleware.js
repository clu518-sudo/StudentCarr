const { RateLimiterMemory } = require("rate-limiter-flexible");

const loginLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60 * 15,
});

const signupLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60 * 15,
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

module.exports = {
  loginRateLimit,
  signupRateLimit,
};
