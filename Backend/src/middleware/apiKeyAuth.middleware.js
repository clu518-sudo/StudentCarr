import crypto from "crypto";
import prisma from "../lib/prisma.js";

const hashApiKey = (rawKey) =>
  crypto.createHash("sha256").update(rawKey).digest("hex");

// Get apiKey verify and find related user
const requireApiKeyAuth = async (req, res, next) => {
  try {
    const authorizationHeader = req.headers.authorization || "";
    const rawKey = authorizationHeader.startsWith("Bearer ")
      ? authorizationHeader.slice(7).trim()
      : null;

    // Reject when header missing or tocken is not my API format
    if (!rawKey || !rawKey.startsWith("sc_")) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const hashedKey = hashApiKey(rawKey);

    const apiKey = await prisma.apiKey.findUnique({
      where: { hashedKey },
      select: {
        id: true,
        userId: true,
        revoked: true,
      },
    });

    // Reject if apiKey doesn't exit or has been revoked
    if (!apiKey || apiKey.revoked) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // Attach authenticated identity to request for downstream handlers
    req.user = {
      id: apiKey.userId,
      userId: apiKey.userId,
      authType: "apiKey",
      apiKeyId: apiKey.id,
    };

    // Track usage time
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    // this is a middleware
    return next();
  } catch (error) {
    // Any unexpected error
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
};

export { requireApiKeyAuth };
