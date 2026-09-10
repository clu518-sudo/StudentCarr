// Builds the demo resume PDF (same content seed-demo-data.js / the
// self-service "Create demo account" button inject for a user) and writes
// it into Backend/uploads/ — no account/database involved, just for
// (re)generating and previewing the PDF itself.
//
// demoData.service.js's seedResumeDocument reuses this exact file as the
// source it copies into a named user's upload location, so running this
// first is optional (it's built automatically if missing) but lets you
// inspect or refresh the PDF independently. Run from Backend/.
//
// Usage:
//   node scripts/build-demo-resume-pdf.js [output-path]
//
// Defaults to writing Backend/uploads/<DEMO_RESUME_ORIGINAL_NAME>.
import fs from "fs";
import path from "path";
import "../src/config/env.js"; // side effect: loads Backend/.env
import {
  buildDemoResumePdfBuffer,
  DEMO_RESUME_SOURCE_PATH,
} from "../src/demoData/demoData.service.js";

const outputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : DEMO_RESUME_SOURCE_PATH;

const main = async () => {
  const pdfBuffer = await buildDemoResumePdfBuffer();
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, pdfBuffer);
  console.log(`Wrote ${pdfBuffer.length} bytes to ${outputPath}`);
};

main().catch((error) => {
  console.error("build-demo-resume-pdf failed:", error.message);
  process.exitCode = 1;
});
