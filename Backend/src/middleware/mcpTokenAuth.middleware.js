import { verifyMcpToken } from "../chat/mcpToken.js";

const requireMcpTokenAuth = (req, res, next) => {
  try {
    const authorizationHeader = req.headers.authorization || "";
    const token = authorizationHeader.startsWith("Bearer ")
      ? authorizationHeader.slice(7).trim()
      : null;

    if (!token) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const payload = verifyMcpToken(token);

    req.user = { id: payload.sub };
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
};

export { requireMcpTokenAuth };
