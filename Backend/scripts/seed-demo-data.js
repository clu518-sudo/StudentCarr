// Server-side demo-data injection CLI. Run from Backend/ so config/env.js can
// resolve .env / DATABASE_URL the same way the app does (see mint-mcp-token.js
// for the same convention).
//
// Usage:
//   node scripts/seed-demo-data.js <email>
//   node scripts/seed-demo-data.js <email> --clear
//
// Seeds two things for an existing user (content lives in
// src/demoData/demoData.service.js, shared with the self-service "Create
// demo account" button — see src/demoAccounts/):
//   1. A demo resume PDF, pushed through the real upload pipeline
//      (uploadSingleDocumentForUser — the same code path the Profile page's
//      Upload button uses), so it lands on disk under uploads/profile/ and
//      is parsed by the real document-parsing queue. Nothing is written
//      into the profile tables directly — the account starts with an empty
//      profile, and the "AI Generate Profile" button on the Profile page is
//      what turns this resume into structured profile data, so that
//      feature actually gets exercised rather than short-circuited.
//   2. A demo "Progress Tracking" inbox — a fake, inactive Gmail account
//      plus a handful of application-tracking emails across a few statuses.
//      This content is hardcoded; nothing here calls out to an LLM or a
//      real Gmail account.
//
// The target account must already exist (see create-user.js / grant-admin.js
// to create one first). Re-running is safe: the resume upload is skipped if
// one is already seeded, and applications/emails are upserted on their
// natural keys — so seeding twice does not duplicate rows. --clear removes
// everything this script seeded (the demo resume document + file, and the
// progress-tracking data) instead of adding it; it does not touch a profile
// the user has since generated or edited themselves.
import "../src/config/env.js"; // side effect: loads Backend/.env
import prisma from "../src/lib/prisma.js";
import {
  seedDemoDataForUser,
  clearDemoDataForUser,
} from "../src/demoData/demoData.service.js";

const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const usage = () => {
  console.error("Usage:");
  console.error("  node scripts/seed-demo-data.js <email>");
  console.error("  node scripts/seed-demo-data.js <email> --clear");
};

const findUserOrExit = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(
      `No account found for ${email}. Create one first with create-user.js or grant-admin.js.`,
    );
    process.exit(1);
  }
  return user;
};

const main = async () => {
  const args = process.argv.slice(2);
  const email = normalizeEmail(args[0]);
  const clear = args.includes("--clear");

  if (!email) {
    usage();
    process.exit(1);
  }

  const user = await findUserOrExit(email);

  if (clear) {
    const { resumeDocCount } = await clearDemoDataForUser(user);
    console.log(
      `Cleared demo resume document (${resumeDocCount} file(s)) and progress-tracking data for ${user.email}`,
    );
    return;
  }

  const { resumeDocument, applicationCount, emailCount } = await seedDemoDataForUser(user);
  console.log(
    `Resume: document ${resumeDocument.id}, parserStatus "${resumeDocument.parserStatus}"` +
      (resumeDocument.parserError ? ` (${resumeDocument.parserError})` : ""),
  );
  console.log(`Seeded ${applicationCount} demo application(s) and ${emailCount} demo email(s) for ${user.email}`);
  console.log(
    `Done. Log in as ${user.email}, open Profile, and click "Generate Profile" to try the AI feature on the seeded resume. Open Progress to see the demo applications/emails.`,
  );
};

main()
  .catch((error) => {
    console.error("seed-demo-data failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
