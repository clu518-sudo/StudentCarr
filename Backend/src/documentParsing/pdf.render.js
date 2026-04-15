import fs from "fs/promises";
import {
  createCanvas,
  Image,
  DOMMatrix,
  ImageData,
  Path2D,
} from "@napi-rs/canvas";

const ensureCanvasGlobals = () => {
  if (!globalThis.Image) {
    globalThis.Image = Image;
  }
  if (!globalThis.DOMMatrix) {
    globalThis.DOMMatrix = DOMMatrix;
  }
  if (!globalThis.ImageData) {
    globalThis.ImageData = ImageData;
  }
  if (!globalThis.Path2D) {
    globalThis.Path2D = Path2D;
  }
};

let pdfJsPromise;

const loadPdfJs = async () => {
  ensureCanvasGlobals();
  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist/legacy/build/pdf.mjs");
  }
  return pdfJsPromise;
};

const loadPdfDocument = async (filePath) => {
  const pdfjs = await loadPdfJs();
  const fileBuffer = await fs.readFile(filePath);
  return pdfjs.getDocument({
    data: new Uint8Array(fileBuffer),
    disableWorker: true,
    useSystemFonts: true,
  }).promise;
};

const renderPdfPageToPng = async (pdfDocument, pageNumber, scale = 1.5) => {
  const page = await pdfDocument.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(
    Math.max(1, Math.ceil(viewport.width)),
    Math.max(1, Math.ceil(viewport.height)),
  );
  const canvasContext = canvas.getContext("2d");

  await page.render({
    canvasContext,
    viewport,
  }).promise;

  const imageBuffer = canvas.toBuffer("image/png");
  page.cleanup();
  return imageBuffer;
};

export { loadPdfDocument, renderPdfPageToPng };
