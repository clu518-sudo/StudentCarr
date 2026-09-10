// Writes the demo resume PDF (same content seed-demo-data.js uploads for a
// user) to a plain file on disk, with no account/database involved — for
// previewing the PDF itself. Run from Backend/.
//
// Usage:
//   node scripts/build-demo-resume-pdf.js [output-path]
//
// Defaults to writing Jordan-Ellis-Demo-Resume.pdf in the repo root.
import fs from "fs";
import path from "path";
import { buildDemoResumePdfBuffer, DEMO_RESUME_ORIGINAL_NAME } from "./seed-demo-data.js";

const outputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(process.cwd(), "..", DEMO_RESUME_ORIGINAL_NAME);

const main = async () => {
  const pdfBuffer = await buildDemoResumePdfBuffer();
  await fs.promises.writeFile(outputPath, pdfBuffer);
  console.log(`Wrote ${pdfBuffer.length} bytes to ${outputPath}`);
};

main().catch((error) => {
  console.error("build-demo-resume-pdf failed:", error.message);
  process.exitCode = 1;
});
