import env from "../config/env.js";
import {
  listDocumentsNeedingParsing,
  parseDocumentById,
} from "./parser.service.js";

const queuedIds = new Set();
const queue = [];
let activeWorkers = 0;

const pumpQueue = () => {
  while (
    activeWorkers < env.documentParserConcurrency &&
    queue.length
  ) {
    const documentId = queue.shift();
    activeWorkers += 1;

    parseDocumentById(documentId)
      .catch((error) => {
        console.error("Document parsing worker failed", error);
      })
      .finally(() => {
        queuedIds.delete(documentId);
        activeWorkers -= 1;
        pumpQueue();
      });
  }
};

const enqueueDocumentParsing = (documentId) => {
  if (!documentId || queuedIds.has(documentId)) {
    return false;
  }

  queuedIds.add(documentId);
  queue.push(documentId);
  setTimeout(pumpQueue, 0);
  return true;
};

const bootstrapDocumentParsingQueue = async () => {
  const pendingDocuments = await listDocumentsNeedingParsing();
  pendingDocuments.forEach((document) => {
    enqueueDocumentParsing(document.id);
  });
  return pendingDocuments.length;
};

export { bootstrapDocumentParsingQueue, enqueueDocumentParsing };
