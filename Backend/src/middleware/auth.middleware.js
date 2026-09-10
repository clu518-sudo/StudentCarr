import { verifyAccessToken } from "../lib/token.js";
import prisma from "../lib/prisma.js";

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  isEmailVerified: true,
  authProvider: true,
  createdAt: true,
  role: true,
  chatHistoryClears: true,
};

const extractBearerToken = (req) => {
  const authorizationHeader = req.headers.authorization || "";
  return authorizationHeader.startsWith("Bearer ")
    ? authorizationHeader.slice(7)
    : null;
};

const requireAuth = async (req, res, next) => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: userSelect,
    });

    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
};

// Like requireAuth, but never blocks the request — it populates req.user
// when a valid Bearer token names an existing user, and just continues
// otherwise (missing token, invalid token, deleted user — all treated as
// "anonymous", never a 401). For routes that must stay reachable by anyone
// (e.g. the public demo-account endpoint) but still want to recognize an
// authenticated admin caller to grant them an exemption.
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractBearerToken(req);
    if (!token) return next();

    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: userSelect,
    });
    if (user) {
      req.user = user;
    }
  } catch {
    // Any failure here just means the caller is anonymous.
  }
  return next();
};

// Gate for admin-only routes (LLM settings, document uploads). Must run
// after requireAuth so req.user is already populated.
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ success: false, error: "Administrator access required" });
  }
  return next();
};

export { requireAuth, optionalAuth, requireAdmin };
