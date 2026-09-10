// Server-side demo-data injection CLI. Run from Backend/ so config/env.js can
// resolve .env / DATABASE_URL the same way the app does (see mint-mcp-token.js
// for the same convention).
//
// Usage:
//   node scripts/seed-demo-data.js <email>
//   node scripts/seed-demo-data.js <email> --clear
//
// Seeds two things for an existing user:
//   1. A demo resume PDF, built directly in this script (via pdfkit) and
//      pushed through the real upload pipeline (uploadSingleDocumentForUser
//      — the same code path the Profile page's Upload button uses), so it
//      lands on disk under uploads/profile/ and is parsed by the real
//      document-parsing queue. Nothing is written into the profile tables
//      directly — the account starts with an empty profile, and the "AI
//      Generate Profile" button on the Profile page is what turns this
//      resume into structured profile data, so that feature actually gets
//      exercised rather than short-circuited.
//   2. A demo "Progress Tracking" inbox — a fake, inactive Gmail account
//      plus a handful of application-tracking emails across a few statuses.
//      This content is hardcoded here too; nothing here calls out to an LLM
//      or a real Gmail account.
//
// The target account must already exist (see create-user.js / grant-admin.js
// to create one first). Re-running is safe: the resume upload is skipped if
// one is already seeded, and applications/emails are upserted on their
// natural keys — so seeding twice does not duplicate rows. --clear removes
// everything this script seeded (the demo resume document + file, and the
// progress-tracking data) instead of adding it; it does not touch a profile
// the user has since generated or edited themselves.
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import PDFDocument from "pdfkit";
import "../src/config/env.js"; // side effect: loads Backend/.env
import prisma from "../src/lib/prisma.js";
import { uploadSingleDocumentForUser } from "../src/profileManagement/pm.service.js";
import { uploadDirectory, removeFileSafe } from "../src/profileManagement/pm.storage.js";

const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

// Same normalization pt.service.js's upsertApplicationForExtraction uses for
// the (userId, companyNameNormalized, positionTitleNormalized) unique key —
// duplicated here rather than imported since it's a private helper there.
const normalizeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const usage = () => {
  console.error("Usage:");
  console.error("  node scripts/seed-demo-data.js <email>");
  console.error("  node scripts/seed-demo-data.js <email> --clear");
};

// ---------------------------------------------------------------------------
// Demo content — all hardcoded here, not generated.
// ---------------------------------------------------------------------------

// Identity used for both the resume PDF and the fake Gmail account below —
// kept separate from DEMO_APPLICATIONS since both need it.
const DEMO_IDENTITY = {
  name: "Jordan Ellis",
  headline: "Full-Stack Software Engineer",
  email: "jordan.ellis.demo@example.com",
  phone: "+64 21 555 0134",
  location: "Auckland, New Zealand",
  github: "github.com/demo-jordan",
  linkedin: "linkedin.com/in/demo-jordan",
};

// The resume PDF's content — plain resume text, not the app's internal
// profile shape. Turning this into structured profile data is exactly what
// the "Generate Profile" AI feature on the Profile page is for.
const DEMO_RESUME_ORIGINAL_NAME = "Jordan-Ellis-Demo-Resume.pdf";
const DEMO_RESUME_SECTIONS = [
  {
    heading: "SUMMARY",
    lines: [
      "Final-year Computer Science student with two internships building production web applications.",
      "Comfortable across the stack from React front ends to Node/Express APIs, with a growing interest",
      "in applied AI tooling.",
    ],
  },
  {
    heading: "EDUCATION",
    lines: [
      "University of Auckland — Bachelor of Science, Computer Science",
      "Feb 2022 – Nov 2026 (expected) | First Class Honours (in progress)",
      "Coursework in algorithms, databases, distributed systems, and machine learning.",
    ],
  },
  {
    heading: "WORK EXPERIENCE",
    lines: [
      "Software Engineering Intern — Northbridge Digital",
      "Nov 2025 – Feb 2026 | Auckland, New Zealand",
      "• Developed a React/Node dashboard that reduced average ticket triage time by 30%",
      "• Wrote integration tests that lifted backend coverage from 41% to 78%",
      "• Paired with senior engineers on a Postgres schema migration affecting 40k+ records",
      "",
      "Student Developer — StudentCarr Labs (Capstone Project)",
      "Mar 2025 – Oct 2025 | Auckland, New Zealand",
      "• Designed the database schema for a multi-user application-tracking feature",
      "• Implemented Gmail OAuth sync and AI email classification",
    ],
  },
  {
    heading: "PROJECTS",
    lines: [
      "Career Copilot — Full-Stack Developer (Jun 2025 – Sep 2025)",
      "A chatbot that answers questions about a user's job applications using retrieval over their inbox.",
      "Technologies: React, Node.js, LangChain, SQLite",
      "",
      "Campus Marketplace — Backend Engineer (Sep 2024 – Feb 2025)",
      "A peer-to-peer marketplace for university students, with Stripe-based escrow payments.",
      "Technologies: Express, PostgreSQL, Stripe, Docker",
    ],
  },
  {
    heading: "SKILLS",
    lines: ["JavaScript, React, Node.js, SQL, Python, Docker"],
  },
  {
    heading: "CERTIFICATIONS",
    lines: [
      "AWS Certified Cloud Practitioner — Amazon Web Services (Issued May 2025, Expires May 2028)",
    ],
  },
];

// Renders DEMO_RESUME_SECTIONS as a one-page PDF using pdfkit's built-in
// Helvetica fonts (no external font files, so this needs no network access).
const buildDemoResumePdfBuffer = () =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Helvetica-Bold").fontSize(18).text(DEMO_IDENTITY.name);
    doc.font("Helvetica").fontSize(11).text(DEMO_IDENTITY.headline);
    doc
      .fontSize(9)
      .fillColor("#444444")
      .text(
        `${DEMO_IDENTITY.location} | ${DEMO_IDENTITY.phone} | ${DEMO_IDENTITY.email}`,
      )
      .text(`${DEMO_IDENTITY.github} | ${DEMO_IDENTITY.linkedin}`)
      .fillColor("#000000");
    doc.moveDown();

    for (const section of DEMO_RESUME_SECTIONS) {
      doc.font("Helvetica-Bold").fontSize(12).text(section.heading);
      doc.font("Helvetica").fontSize(10);
      for (const line of section.lines) {
        if (line === "") {
          doc.moveDown(0.3);
        } else {
          doc.text(line);
        }
      }
      doc.moveDown();
    }

    doc.end();
  });

// Each application's `emails` are listed oldest-first; the application's
// status is taken from the last email's intent (matching INTENT_TO_STATUS in
// pt.service.js). daysAgo is relative to when the script runs, so seeded data
// always looks recent.
const DEMO_APPLICATIONS = [
  {
    company: "Totara Cloud",
    position: "Full-Stack Developer",
    contactEmail: "recruiting@totaracloud.example.com",
    emails: [
      {
        intent: "applied_confirmation",
        daysAgo: 5,
        subject: "We've received your application — Full-Stack Developer",
        sender: "Totara Cloud Recruiting",
        senderEmail: "recruiting@totaracloud.example.com",
        snippet: "Thanks for applying to the Full-Stack Developer role at Totara Cloud.",
        body:
          "Hi Jordan,\n\nThanks for applying to the Full-Stack Developer role at Totara Cloud. " +
          "We've received your resume and our team is reviewing applications now. " +
          "We aim to get back to every applicant within two weeks.\n\nBest,\nTotara Cloud Recruiting",
      },
    ],
  },
  {
    company: "Anchorpoint Systems",
    position: "Software Engineer",
    contactEmail: "hiring@anchorpointsystems.example.com",
    emails: [
      {
        intent: "applied_confirmation",
        daysAgo: 12,
        subject: "Application received — Software Engineer",
        sender: "Anchorpoint Systems Hiring Team",
        senderEmail: "hiring@anchorpointsystems.example.com",
        snippet: "This confirms we've received your application for Software Engineer.",
        body:
          "Hi Jordan,\n\nThis confirms we've received your application for the Software Engineer role. " +
          "A member of our hiring team will follow up shortly.\n\nThanks,\nAnchorpoint Systems Hiring Team",
      },
      {
        intent: "follow_up",
        daysAgo: 4,
        subject: "Re: Software Engineer application — quick update",
        sender: "Priya Nair",
        senderEmail: "priya.nair@anchorpointsystems.example.com",
        snippet: "Your application is still under review with the engineering team.",
        body:
          "Hi Jordan,\n\nJust a quick update — your application is still under review with the engineering team. " +
          "We've had a strong pool of applicants this round, so it's taking a little longer than usual. " +
          "We'll be in touch by the end of next week either way.\n\nBest,\nPriya",
      },
    ],
  },
  {
    company: "Kōwhai Analytics",
    position: "Data Engineer",
    contactEmail: "talent@kowhaianalytics.example.com",
    emails: [
      {
        intent: "applied_confirmation",
        daysAgo: 10,
        subject: "Thanks for applying — Data Engineer, Kōwhai Analytics",
        sender: "Kōwhai Analytics Talent Team",
        senderEmail: "talent@kowhaianalytics.example.com",
        snippet: "We've received your application for the Data Engineer position.",
        body:
          "Hi Jordan,\n\nWe've received your application for the Data Engineer position at Kōwhai Analytics. " +
          "We'll review it against the role requirements and reach out about next steps.\n\nThanks,\nKōwhai Analytics Talent Team",
      },
      {
        intent: "invite",
        daysAgo: 2,
        subject: "Interview invitation — Data Engineer",
        sender: "Kōwhai Analytics Talent Team",
        senderEmail: "talent@kowhaianalytics.example.com",
        snippet: "We'd love to schedule a first-round interview for the Data Engineer role.",
        body:
          "Hi Jordan,\n\nWe were impressed by your application and would love to schedule a first-round " +
          "interview for the Data Engineer role. Could you let us know your availability over the next week? " +
          "The first round is a 45-minute video call with two of our engineers.\n\nLooking forward to hearing from you,\nKōwhai Analytics Talent Team",
        needsReplyDraft: true,
      },
    ],
  },
  {
    company: "Piwakawaka Health Tech",
    position: "Backend Engineer",
    contactEmail: "careers@piwakawakahealth.example.com",
    emails: [
      {
        intent: "applied_confirmation",
        daysAgo: 21,
        subject: "Application received — Backend Engineer",
        sender: "Piwakawaka Health Tech Careers",
        senderEmail: "careers@piwakawakahealth.example.com",
        snippet: "Thanks for your interest in the Backend Engineer role.",
        body:
          "Hi Jordan,\n\nThanks for your interest in the Backend Engineer role at Piwakawaka Health Tech. " +
          "We'll be in touch once we've reviewed your application.\n\nBest,\nPiwakawaka Health Tech Careers",
      },
      {
        intent: "rejection",
        daysAgo: 8,
        subject: "Update on your Backend Engineer application",
        sender: "Piwakawaka Health Tech Careers",
        senderEmail: "careers@piwakawakahealth.example.com",
        snippet: "We've decided to move forward with other candidates at this time.",
        body:
          "Hi Jordan,\n\nThank you for taking the time to apply for the Backend Engineer role. " +
          "After careful consideration, we've decided to move forward with other candidates at this time. " +
          "We were impressed by your background and would encourage you to apply again in the future.\n\n" +
          "Best of luck,\nPiwakawaka Health Tech Careers",
      },
    ],
  },
];

const INTENT_TO_STATUS = {
  applied_confirmation: "applied",
  follow_up: "under_review",
  invite: "invited",
  rejection: "rejected",
  offer: "offer",
};

// ---------------------------------------------------------------------------

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

// Only removes what this script seeds — the demo resume document (DB row +
// file on disk) and the progress-tracking data. A profile the user has since
// generated or edited via the app is left untouched.
const clearDemoData = async (user) => {
  const resumeDocs = await prisma.profileDocument.findMany({
    where: { userId: user.id, originalName: DEMO_RESUME_ORIGINAL_NAME },
    select: { id: true, path: true },
  });
  await prisma.profileDocument.deleteMany({
    where: { id: { in: resumeDocs.map((doc) => doc.id) } },
  });
  await Promise.all(resumeDocs.map((doc) => removeFileSafe(doc.path)));

  // Emails first (their onDelete: SetNull toward the application would
  // otherwise orphan them once the application is gone); everything else
  // cascades from there.
  await prisma.progressEmail.deleteMany({ where: { userId: user.id } });
  await prisma.progressApplication.deleteMany({ where: { userId: user.id } });
  await prisma.gmailAccount.deleteMany({ where: { userId: user.id } });
  console.log(
    `Cleared demo resume document (${resumeDocs.length} file(s)) and progress-tracking data for ${user.email}`,
  );
};

// Waits for the parsing queue (enqueued inside uploadSingleDocumentForUser)
// to finish with this document, since it runs in-process via a scheduled
// timer — without this the script could disconnect prisma and exit before
// parsing (and the parsedText the AI Generate feature needs) ever happens.
const waitForParserStatus = async (documentId, { timeoutMs = 20000, intervalMs = 200 } = {}) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const document = await prisma.profileDocument.findUnique({
      where: { id: documentId },
      select: { parserStatus: true, parserError: true },
    });
    if (document && document.parserStatus !== "pending") {
      return document;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for document ${documentId} to finish parsing`);
};

// Builds the demo resume PDF and pushes it through the real upload pipeline
// (the same uploadSingleDocumentForUser the Profile page's Upload button
// calls), so it is parsed by the real document-parsing queue exactly like a
// live upload — leaving the account with an unparsed structured profile and
// a ready-to-generate-from resume, for the "Generate Profile" AI feature to
// actually run against.
const seedResumeDocument = async (user) => {
  const existing = await prisma.profileDocument.findFirst({
    where: { userId: user.id, originalName: DEMO_RESUME_ORIGINAL_NAME },
  });
  if (existing) {
    console.log(
      `Demo resume already seeded for ${user.email} (parserStatus: ${existing.parserStatus}). Run with --clear first to reseed.`,
    );
    return;
  }

  const pdfBuffer = await buildDemoResumePdfBuffer();
  const storedName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-demo-resume.pdf`;
  const storedPath = path.join(uploadDirectory, storedName);
  await fs.promises.mkdir(uploadDirectory, { recursive: true });
  await fs.promises.writeFile(storedPath, pdfBuffer);

  const file = {
    originalname: DEMO_RESUME_ORIGINAL_NAME,
    filename: storedName,
    mimetype: "application/pdf",
    size: pdfBuffer.length,
    path: storedPath,
  };

  const document = await uploadSingleDocumentForUser(user.id, file, "Resume");
  console.log(`Uploaded demo resume for ${user.email} (document ${document.id}); parsing...`);

  const parsed = await waitForParserStatus(document.id);
  if (parsed.parserStatus === "completed") {
    console.log("Resume parsed successfully — ready for the Generate Profile feature.");
  } else {
    console.warn(`Resume parsing finished as "${parsed.parserStatus}": ${parsed.parserError || "unknown error"}`);
  }
};

// A fake, permanently-inactive Gmail account — just enough to satisfy
// ProgressEmail's required gmailAccountId FK. isActive: false makes
// getFreshGmailAccessContextForUser (pt.gmail.js) refuse to use it, so the
// app can never attempt a real Gmail API call against these fake tokens.
const seedGmailAccount = async (user) => {
  const account = await prisma.gmailAccount.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      googleSub: `demo-seed-${user.id}`,
      googleEmail: DEMO_IDENTITY.email,
      displayName: DEMO_IDENTITY.name,
      isActive: false,
    },
  });
  return account;
};

const seedApplicationsAndEmails = async (user, gmailAccount) => {
  let applicationCount = 0;
  let emailCount = 0;

  for (const app of DEMO_APPLICATIONS) {
    const companyNameNormalized = normalizeKey(app.company);
    const positionTitleNormalized = normalizeKey(app.position);
    const lastEmail = app.emails[app.emails.length - 1];
    const status = INTENT_TO_STATUS[lastEmail.intent] || "under_review";
    const lastUpdatedAt = daysAgo(lastEmail.daysAgo);

    const application = await prisma.progressApplication.upsert({
      where: {
        userId_companyNameNormalized_positionTitleNormalized: {
          userId: user.id,
          companyNameNormalized,
          positionTitleNormalized,
        },
      },
      update: {
        gmailAccountId: gmailAccount.id,
        companyName: app.company,
        positionTitle: app.position,
        contactEmail: app.contactEmail,
        status,
        lastUpdatedAt,
      },
      create: {
        userId: user.id,
        gmailAccountId: gmailAccount.id,
        companyName: app.company,
        companyNameNormalized,
        positionTitle: app.position,
        positionTitleNormalized,
        contactEmail: app.contactEmail,
        status,
        lastUpdatedAt,
      },
    });
    applicationCount += 1;

    for (const [index, emailSpec] of app.emails.entries()) {
      const gmailMessageId = `demo-seed-${companyNameNormalized.replace(/\s+/g, "-")}-${index}`;
      const receivedAt = daysAgo(emailSpec.daysAgo);

      const email = await prisma.progressEmail.upsert({
        where: {
          gmailAccountId_gmailMessageId: {
            gmailAccountId: gmailAccount.id,
            gmailMessageId,
          },
        },
        update: {
          applicationId: application.id,
          subject: emailSpec.subject,
          sender: emailSpec.sender,
          senderEmail: emailSpec.senderEmail,
          snippet: emailSpec.snippet,
          rawBodyText: emailSpec.body,
          receivedAt,
          isUnread: false,
          processingStage: "persisted",
          aiProcessedAt: new Date(),
          needsReplyDraft: Boolean(emailSpec.needsReplyDraft),
        },
        create: {
          userId: user.id,
          gmailAccountId: gmailAccount.id,
          applicationId: application.id,
          gmailMessageId,
          subject: emailSpec.subject,
          sender: emailSpec.sender,
          senderEmail: emailSpec.senderEmail,
          snippet: emailSpec.snippet,
          rawBodyText: emailSpec.body,
          receivedAt,
          isUnread: false,
          processingStage: "persisted",
          aiProcessedAt: new Date(),
          needsReplyDraft: Boolean(emailSpec.needsReplyDraft),
        },
      });
      emailCount += 1;

      await prisma.progressEmailIntelligence.upsert({
        where: { emailId: email.id },
        update: {
          intent: emailSpec.intent,
          companyName: app.company,
          positionTitle: app.position,
          contactEmail: app.contactEmail,
          confidence: 0.92,
          needsReplyDraft: Boolean(emailSpec.needsReplyDraft),
          suggestedApplicationStatus: INTENT_TO_STATUS[emailSpec.intent] || null,
          summary: emailSpec.snippet,
        },
        create: {
          emailId: email.id,
          intent: emailSpec.intent,
          companyName: app.company,
          positionTitle: app.position,
          contactEmail: app.contactEmail,
          confidence: 0.92,
          needsReplyDraft: Boolean(emailSpec.needsReplyDraft),
          suggestedApplicationStatus: INTENT_TO_STATUS[emailSpec.intent] || null,
          summary: emailSpec.snippet,
        },
      });
    }
  }

  console.log(
    `Seeded ${applicationCount} demo application(s) and ${emailCount} demo email(s) for ${user.email}`,
  );
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
    await clearDemoData(user);
    return;
  }

  await seedResumeDocument(user);
  const gmailAccount = await seedGmailAccount(user);
  await seedApplicationsAndEmails(user, gmailAccount);
  console.log(
    `Done. Log in as ${user.email}, open Profile, and click "Generate Profile" to try the AI feature on the seeded resume. Open Progress to see the demo applications/emails.`,
  );
};

// Only auto-run when this file is executed directly (`node scripts/seed-demo-data.js`),
// not when another script imports buildDemoResumePdfBuffer / DEMO_RESUME_ORIGINAL_NAME
// from it (see build-demo-resume-pdf.js). pathToFileURL (not a hand-built
// "file://" string) is what makes this work on Windows, where argv[1] can be
// relative and import.meta.url always has an extra leading slash before the
// drive letter.
const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main()
    .catch((error) => {
      console.error("seed-demo-data failed:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { buildDemoResumePdfBuffer, DEMO_RESUME_ORIGINAL_NAME, DEMO_IDENTITY };
