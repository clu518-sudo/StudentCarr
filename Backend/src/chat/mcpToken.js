import jwt from "jsonwebtoken";
import env from "../config/env.js";

const MCP_TOKEN_TYP = "mcp";
const MCP_TOKEN_AUDIENCE = "studentcarr-mcp";

const signMcpToken = (userId) =>
  jwt.sign({ sub: userId, typ: MCP_TOKEN_TYP }, env.mcpTokenSecret, {
    expiresIn: env.mcpTokenTtl,
    audience: MCP_TOKEN_AUDIENCE,
  });

const verifyMcpToken = (token) => {
  const payload = jwt.verify(token, env.mcpTokenSecret, {
    audience: MCP_TOKEN_AUDIENCE,
    ignoreExpiration: false,
  });

  if (payload.typ !== MCP_TOKEN_TYP) {
    throw new Error("Invalid token type");
  }

  return payload;
};

export { signMcpToken, verifyMcpToken, MCP_TOKEN_AUDIENCE };
