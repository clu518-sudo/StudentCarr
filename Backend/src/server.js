import app from "./app.js";
import env from "./config/env.js";
import { bootstrapDocumentParsingQueue } from "./documentParsing/index.js";

app.listen(env.port, () => {
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
});
