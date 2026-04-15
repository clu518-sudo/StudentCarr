import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import { jest } from "@jest/globals";
import app from "../src/app.js";
import prisma from "../src/lib/prisma.js";
import {
  resetDocumentParsingTestOverrides,
  setDocumentParsingTestOverrides,
} from "../src/documentParsing/index.js";

jest.setTimeout(20000);

const createTestPdf = async (name, contents = "test pdf content") => {
  const targetPath = path.join(os.tmpdir(), `${Date.now()}-${name}.pdf`);
  await fs.promises.writeFile(targetPath, contents);
  return targetPath;
};

const createAuthenticatedUser = async () => {
  const email = `profile_doc_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
  const signupResponse = await request(app).post("/api/auth/signup").send({
    email,
    password: "StrongPass123!",
    fullName: "Profile Document Test User",
  });

  return signupResponse.body.data.accessToken;
};

const uploadSingleDocument = async ({ accessToken, filePath, documentType }) =>
  request(app)
    .post("/api/profile-management/documents/single")
    .set("Authorization", `Bearer ${accessToken}`)
    .field("documentType", documentType)
    .attach("document", filePath);

const waitForDocumentStatus = async (documentId, expectedStatus) => {
  const deadline = Date.now() + 10000;

  while (Date.now() < deadline) {
    const document = await prisma.profileDocument.findUnique({
      where: { id: documentId },
    });

    if (document?.parserStatus === expectedStatus) {
      return document;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timed out waiting for document ${documentId} to reach ${expectedStatus}`);
};

describe("Profile document parsing flow", () => {
  afterEach(async () => {
    resetDocumentParsingTestOverrides();
  });

  afterAll(async () => {
    resetDocumentParsingTestOverrides();
    await prisma.authSession.deleteMany();
    await prisma.authAuditLog.deleteMany();
    await prisma.profileDocument.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();
    await fs.promises.rm(
      path.resolve(process.cwd(), "uploads", "profile"),
      { recursive: true, force: true },
    );
    await prisma.$disconnect();
  });

  it("uploads a PDF, returns pending, and stores embedded text asynchronously", async () => {
    setDocumentParsingTestOverrides({
      extractPdfTextWithLangChain: async () => ({
        text:
          "Jane Doe\nSoftware Engineer\nExperience with React and Node.js, Express, Prisma, and API integrations.\nBuilt internal tools, shipped production features, improved frontend performance, collaborated across teams, and maintained reliable delivery practices.\nCreated dashboards, forms, and document workflows for student profile management systems.",
        pageCount: 2,
      }),
    });

    const accessToken = await createAuthenticatedUser();
    const filePath = await createTestPdf("resume-embedded");
    const uploadResponse = await uploadSingleDocument({
      accessToken,
      filePath,
      documentType: "Resume",
    });

    expect(uploadResponse.status).toBe(201);
    expect(uploadResponse.body.success).toBe(true);
    expect(uploadResponse.body.data.document.parserStatus).toBe("pending");

    const completedDocument = await waitForDocumentStatus(
      uploadResponse.body.data.document.id,
      "completed",
    );

    expect(completedDocument.parsedText).toContain("Software Engineer");
    expect(completedDocument.extractionMethod).toBe("embedded_text");
    expect(completedDocument.pageCount).toBe(2);

    const documentsResponse = await request(app)
      .get("/api/profile-management/documents")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(documentsResponse.status).toBe(200);
    expect(documentsResponse.body.data.documents[0].parsedText).toBeUndefined();
    expect(documentsResponse.body.data.documents[0].parserStatus).toBe("completed");

    await fs.promises.rm(filePath, { force: true });
  });

  it("falls back to vLLM OCR when embedded extraction is insufficient", async () => {
    setDocumentParsingTestOverrides({
      extractPdfTextWithLangChain: async () => ({
        text: "tiny",
        pageCount: 1,
      }),
      extractTextViaVllmFallback: async () => ({
        text: "Recovered OCR text with readable resume content and structured sections.",
        pageCount: 1,
      }),
    });

    const accessToken = await createAuthenticatedUser();
    const filePath = await createTestPdf("resume-ocr");
    const uploadResponse = await uploadSingleDocument({
      accessToken,
      filePath,
      documentType: "Resume",
    });

    const completedDocument = await waitForDocumentStatus(
      uploadResponse.body.data.document.id,
      "completed",
    );

    expect(completedDocument.extractionMethod).toBe("vllm_ocr");
    expect(completedDocument.parsedText).toContain("Recovered OCR text");

    await fs.promises.rm(filePath, { force: true });
  });

  it("stores parser failures without failing the upload request", async () => {
    setDocumentParsingTestOverrides({
      extractPdfTextWithLangChain: async () => ({
        text: "",
        pageCount: 1,
      }),
      extractTextViaVllmFallback: async () => {
        throw new Error("OCR service unavailable");
      },
    });

    const accessToken = await createAuthenticatedUser();
    const filePath = await createTestPdf("resume-failure");
    const uploadResponse = await uploadSingleDocument({
      accessToken,
      filePath,
      documentType: "Resume",
    });

    expect(uploadResponse.status).toBe(201);
    expect(uploadResponse.body.success).toBe(true);

    const failedDocument = await waitForDocumentStatus(
      uploadResponse.body.data.document.id,
      "failed",
    );

    expect(failedDocument.parserError).toContain("OCR service unavailable");
    expect(failedDocument.parsedText).toBeNull();

    await fs.promises.rm(filePath, { force: true });
  });

  it("deletes the stored file and parser metadata with the document", async () => {
    setDocumentParsingTestOverrides({
      extractPdfTextWithLangChain: async () => ({
        text:
          "Delete test content with enough text to avoid OCR fallback. This paragraph is intentionally long so the parser keeps the embedded-text path, stores the plain text result, captures page metadata, and completes without asking the vLLM OCR adapter to render or inspect page images during the test run.",
        pageCount: 1,
      }),
    });

    const accessToken = await createAuthenticatedUser();
    const filePath = await createTestPdf("resume-delete");
    const uploadResponse = await uploadSingleDocument({
      accessToken,
      filePath,
      documentType: "Resume",
    });

    const completedDocument = await waitForDocumentStatus(
      uploadResponse.body.data.document.id,
      "completed",
    );

    expect(fs.existsSync(completedDocument.path)).toBe(true);

    const deleteResponse = await request(app)
      .delete(`/api/profile-management/documents/${completedDocument.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(deleteResponse.status).toBe(200);

    const deletedDocument = await prisma.profileDocument.findUnique({
      where: { id: completedDocument.id },
    });
    expect(deletedDocument).toBeNull();
    expect(fs.existsSync(completedDocument.path)).toBe(false);

    await fs.promises.rm(filePath, { force: true });
  });
});
