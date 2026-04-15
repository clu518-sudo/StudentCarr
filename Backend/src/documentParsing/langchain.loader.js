import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

const normalizeExtractedText = (value = "") =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const extractPdfTextWithLangChain = async (filePath) => {
  const loader = new PDFLoader(filePath, {
    splitPages: true,
  });
  const documents = await loader.load();
  const text = normalizeExtractedText(
    documents.map((document) => document.pageContent || "").join("\n\n"),
  );

  return {
    text,
    pageCount: documents.length,
  };
};

export { extractPdfTextWithLangChain, normalizeExtractedText };
