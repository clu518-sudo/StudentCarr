import { Agent, setGlobalDispatcher } from "undici";

// Tuned for frequent internal loopback traffic (AIServices -> mcp-server,
// Backend -> AIServices) rather than undici's default 4s keepAliveTimeout.
setGlobalDispatcher(
  new Agent({
    keepAliveTimeout: 30_000,
    keepAliveMaxTimeout: 60_000,
    connections: 32,
  }),
);
