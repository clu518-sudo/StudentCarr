import { verifyAccessToken } from "../lib/token.js";
import prisma from "../lib/prisma.js";

const requireAuth = async (req, res, next) => {
  try {
    const authorizationHeader = req.headers.authorization || "";
    const token = authorizationHeader.startsWith("Bearer ")
      ? authorizationHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        isEmailVerified: true,
        authProvider: true,
        createdAt: true,
        role: true,
        chatHistoryClears: true,
      },
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

// Gate for admin-only routes (LLM settings, document uploads). Must run
// after requireAuth so req.user is already populated.
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ success: false, error: "Administrator access required" });
  }
  return next();
};

export { requireAuth, requireAdmin };
