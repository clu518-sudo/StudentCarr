import "./lib/httpAgent.js";
import app from "./app.js";
import env from "./config/env.js";
import { bootstrapDocumentParsingQueue } from "./documentParsing/index.js";
import { startDemoAccountCleanupLoop } from "./demoAccounts/demoAccounts.service.js";

const server = app.listen(env.port, () => {
  console.log(`Auth backend listening on port ${env.port}`);

  bootstrapDocumentParsingQueue()
    .then((count) => {
      if (count > 0) {
        console.log(`Resumed ${count} pending document parsing job(s)`);
      }
    })
    .catch((error) => {
      console.error("Failed to bootstrap document parsing queue", error);
    });

  startDemoAccountCleanupLoop();
});

// Stop accepting new connections and let in-flight requests finish before
// exiting, so an LB-triggered restart doesn't cut off a request mid-flight.
const shutdown = (signal) => {
  console.log(`${signal} received, shutting down gracefully`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
