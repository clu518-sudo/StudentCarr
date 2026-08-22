// "mint a token manually for MCP Inspector testing
import { signMcpToken } from "../src/chat/mcpToken.js";

const userId = process.argv[2];
if (!userId) {
  console.error("Usage: node scripts/mint-mcp-token.js <userId>");
  process.exit(1);
}
console.log(signMcpToken(userId));
