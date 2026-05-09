import prisma from "../lib/prisma.js";
import env from "../config/env.js";
import {
  DOCUMENT_PARSER_STATUS,
  EXTRACTION_METHOD,
} from "./constants.js";
import { emitUserEvent, USER_EVENT_TYPES } from "../events/index.js";
import {
  extractPdfTextWithLangChain,
  normalizeExtractedText,
} from "./langchain.loader.js";
import { loadPdfDocument, renderPdfPageToPng } from "./pdf.render.js";
import { extractTextFromImageWithVllm } from "./vllm.client.js";

const testOverrides = {
  extractPdfTextWithLangChain: null,
  extractTextFromImageWithVllm: null,
  extractTextViaVllmFallback: null,
};

const loadDocumentForParsing = async (documentId) =>
  prisma.profileDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      userId: true,
      path: true,
      parserStatus: true,
    },
  });

const documentEventSelect = {
  userId: true,
  id: true,
  documentType: true,
  originalName: true,
  mimeType: true,
  size: true,
  status: true,
  parserStatus: true,
  extractionMethod: true,
  pageCount: true,
  parserError: true,
  parserStartedAt: true,
  parserCompletedAt: true,
  parserUpdatedAt: true,
  uploadedAt: true,
};

const mapDocumentEventPayload = (document) => ({
  id: document.id,
  documentType: document.documentType,
  originalName: document.originalName,
  mimeType: document.mimeType,
  size: document.size,
  status: document.parserStatus || document.status,
  uploadStatus: document.status,
  parserStatus: document.parserStatus,
  extractionMethod: document.extractionMethod,
  pageCount: document.pageCount,
  parserError: document.parserError,
  parserStartedAt: document.parserStartedAt,
  parserCompletedAt: document.parserCompletedAt,
  parserUpdatedAt: document.parserUpdatedAt,
  uploadedAt: document.uploadedAt,
});

const emitDocumentParsingUpdated = (document) => {
  if (!document?.userId) {
    return;
  }

  emitUserEvent(document.userId, USER_EVENT_TYPES.DOCUMENT_PARSING_UPDATED, {
    document: mapDocumentEventPayload(document),
  });
};

const listDocumentsNeedingParsing = async () =>
  prisma.profileDocument.findMany({
    where: {
      parserStatus: {
        in: [
          DOCUMENT_PARSER_STATUS.PENDING,
          DOCUMENT_PARSER_STATUS.PROCESSING,
        ],
      },
    },
    select: { id: true },
    orderBy: { uploadedAt: "asc" },
  });

const hasSufficientText = (text = "") =>
  text.replace(/\s/g, "").length >= env.documentParserMinCharacters;

const runLangChainExtraction = async (filePath) => {
  const extractor =
    testOverrides.extractPdfTextWithLangChain || extractPdfTextWithLangChain;
  return extractor(filePath);
};

const runVllmOcr = async (imageBuffer) => {
  const extractor =
    testOverrides.extractTextFromImageWithVllm || extractTextFromImageWithVllm;
  return extractor(imageBuffer);
};

const extractTextViaVllmFallback = async (filePath) => {
  if (testOverrides.extractTextViaVllmFallback) {
    return testOverrides.extractTextViaVllmFallback(filePath);
  }

  const pdfDocument = await loadPdfDocument(filePath);
  const pageTexts = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const pageBuffer = await renderPdfPageToPng(
        pdfDocument,
        pageNumber,
        env.documentParserRenderScale,
      );
      const pageText = await runVllmOcr(pageBuffer);

      if (pageText?.trim()) {
        pageTexts.push(pageText.trim());
      }
    }
  } finally {
    await pdfDocument.destroy();
  }

  return {
    text: normalizeExtractedText(pageTexts.join("\n\n")),
    pageCount: pdfDocument.numPages,
  };
};

const parseDocumentById = async (documentId) => {
  const document = await loadDocumentForParsing(documentId);
  if (!document) {
    return { status: "deleted" };
  }

  if (document.parserStatus === DOCUMENT_PARSER_STATUS.COMPLETED) {
    return { status: DOCUMENT_PARSER_STATUS.COMPLETED };
  }

  const startedAt = new Date();
  const processingUpdate = await prisma.profileDocument.updateMany({
    where: { id: documentId },
    data: {
      parserStatus: DOCUMENT_PARSER_STATUS.PROCESSING,
      parserError: null,
      parserStartedAt: startedAt,
      parserCompletedAt: null,
    },
  });

  if (!processingUpdate.count) {
    return { status: "deleted" };
  }

  const processingDocument = await prisma.profileDocument.findUnique({
    where: { id: documentId },
    select: documentEventSelect,
  });
  emitDocumentParsingUpdated(processingDocument);

  try {
    const embeddedResult = await runLangChainExtraction(document.path);
    let text = normalizeExtractedText(embeddedResult?.text || "");
    let pageCount = embeddedResult?.pageCount || null;
    let extractionMethod = EXTRACTION_METHOD.EMBEDDED_TEXT;

    if (!hasSufficientText(text)) {
      const ocrResult = await extractTextViaVllmFallback(document.path);
      text = normalizeExtractedText(ocrResult?.text || "");
      pageCount = ocrResult?.pageCount || pageCount;
      extractionMethod = EXTRACTION_METHOD.VLLM_OCR;
    }

    if (!text) {
      throw new Error("No text could be extracted from PDF");
    }

    const completedAt = new Date();
    const completedDocument = await prisma.profileDocument.update({
      where: { id: documentId },
      data: {
        parserStatus: DOCUMENT_PARSER_STATUS.COMPLETED,
        parsedText: text,
        extractionMethod,
        pageCount,
        parserError: null,
        parserCompletedAt: completedAt,
      },
      select: documentEventSelect,
    });
    emitDocumentParsingUpdated(completedDocument);

    return {
      status: DOCUMENT_PARSER_STATUS.COMPLETED,
      extractionMethod,
      pageCount,
    };
  } catch (error) {
    const message = error?.message || "Document parsing failed";

    await prisma.profileDocument.updateMany({
      where: { id: documentId },
      data: {
        parserStatus: DOCUMENT_PARSER_STATUS.FAILED,
        parsedText: null,
        extractionMethod: null,
        pageCount: null,
        parserError: message,
        parserCompletedAt: null,
      },
    });

    const failedDocument = await prisma.profileDocument.findUnique({
      where: { id: documentId },
      select: documentEventSelect,
    });
    emitDocumentParsingUpdated(failedDocument);

    return {
      status: DOCUMENT_PARSER_STATUS.FAILED,
      error: message,
    };
  }
};

const setDocumentParsingTestOverrides = (overrides = {}) => {
  testOverrides.extractPdfTextWithLangChain =
    overrides.extractPdfTextWithLangChain || null;
  testOverrides.extractTextFromImageWithVllm =
    overrides.extractTextFromImageWithVllm || null;
  testOverrides.extractTextViaVllmFallback =
    overrides.extractTextViaVllmFallback || null;
};

const resetDocumentParsingTestOverrides = () => {
  setDocumentParsingTestOverrides();
};

export {
  listDocumentsNeedingParsing,
  parseDocumentById,
  resetDocumentParsingTestOverrides,
  setDocumentParsingTestOverrides,
};
