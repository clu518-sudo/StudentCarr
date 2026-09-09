import { Agent, setGlobalDispatcher } from "undici";

// Tuned for frequent internal loopback traffic (Backend -> AIServices) rather
// than undici's default 4s keepAliveTimeout, which would otherwise recycle
// sockets between chat turns more often than necessary.
setGlobalDispatcher(
  new Agent({
    keepAliveTimeout: 30_000,
    keepAliveMaxTimeout: 60_000,
    connections: 32,
  }),
);
