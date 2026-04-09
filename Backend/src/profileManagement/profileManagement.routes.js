import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { uploadProfileDocuments } from "./pm.storage.js";
import {
  getProfile,
  updateManualProfile,
  uploadDocuments,
  uploadSingleDocument,
  getDocuments,
  deleteDocument,
  downloadDocument,
  handleUploadError,
} from "./pm.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", getProfile);
router.put("/manual", updateManualProfile);
router.post(
  "/documents",
  uploadProfileDocuments.array("documents", 10),
  handleUploadError,
  uploadDocuments,
);
router.post(
  "/documents/single",
  uploadProfileDocuments.single("document"),
  handleUploadError,
  uploadSingleDocument,
);
router.get("/documents", getDocuments);
router.get("/documents/:id/download", downloadDocument);
router.delete("/documents/:id", deleteDocument);

export default router;
