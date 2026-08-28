import { MultiServerMCPClient } from "@langchain/mcp-adapters";

const MCP_SERVER_URL = String(
  process.env.MCP_SERVER_URL || "http://127.0.0.1:10004",
).replace(/\/$/, "");

// Must stay below Backend's MCP_TOKEN_TTL (2m): headers are bound at client
// construction, so an entry that outlives its token would send an expired one.
const CLIENT_TTL_MS = Number(process.env.MCP_CLIENT_TTL_MS || 90000);

type McpTools = Awaited<ReturnType<MultiServerMCPClient["getTools"]>>;

type CacheEntry = {
  client: MultiServerMCPClient;
  tools: Promise<McpTools>;
  expiresAt: number;
};

const clientCache = new Map<string, CacheEntry>();

const closeQuietly = (client: MultiServerMCPClient) => {
  void client.close().catch(() => {
    /* connection already gone */
  });
};

const evict = (userId: string, entry?: CacheEntry) => {
  const current = clientCache.get(userId);
  if (!current || (entry && current !== entry)) {
    return;
  }
  clientCache.delete(userId);
  closeQuietly(current.client);
};

const sweepExpired = (now: number) => {
  for (const [userId, entry] of clientCache) {
    if (entry.expiresAt <= now) {
      evict(userId, entry);
    }
  }
};

const buildClient = (mcpToken: string) =>
  new MultiServerMCPClient({
    mcpServers: {
      studentcarr: {
        transport: "http",
        url: `${MCP_SERVER_URL}/mcp`,
        headers: { Authorization: `Bearer ${mcpToken}` },
      },
    },
  });

// One client per user, because the scoped token travels as a construction-time
// header. The promise is cached (not the resolved array) so concurrent turns for
// the same user share a single connection instead of racing to build two.
export const getMcpTools = async ({
  userId,
  mcpToken,
}: {
  userId: string;
  mcpToken: string;
}): Promise<McpTools> => {
  const now = Date.now();
  sweepExpired(now);

  const cached = clientCache.get(userId);
  if (cached) {
    return cached.tools;
  }

  const client = buildClient(mcpToken);
  const entry: CacheEntry = {
    client,
    tools: client.getTools(),
    expiresAt: now + CLIENT_TTL_MS,
  };
  clientCache.set(userId, entry);

  try {
    const tools = await entry.tools;
    console.log(
      `[chat] MCP client connected for user ${userId} (${tools.length} tools)`,
    );
    return tools;
  } catch (error) {
    evict(userId, entry);
    throw error;
  }
};

export const closeAllMcpClients = async () => {
  const entries = [...clientCache.values()];
  clientCache.clear();
  await Promise.all(entries.map((entry) => entry.client.close().catch(() => {})));
};
