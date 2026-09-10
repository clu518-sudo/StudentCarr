import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";
import { uploadProfileDocuments } from "./pm.storage.js";
import {
  getProfile,
  updateManualProfile,
  uploadDocuments,
  uploadSingleDocument,
  getDocuments,
  deleteDocument,
  downloadDocument,
  generateManualProfileStream,
  handleUploadError,
} from "./pm.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", getProfile);
router.put("/manual", updateManualProfile);
router.post("/manual/generate/stream", generateManualProfileStream);
// Uploads are admin-only in the demo deploy; requireAdmin runs before multer
// so a rejected upload never touches disk.
router.post(
  "/documents",
  requireAdmin,
  uploadProfileDocuments.array("documents", 10),
  handleUploadError,
  uploadDocuments,
);
router.post(
  "/documents/single",
  requireAdmin,
  uploadProfileDocuments.single("document"),
  handleUploadError,
  uploadSingleDocument,
);
router.get("/documents", getDocuments);
router.get("/documents/:id/download", downloadDocument);
router.delete("/documents/:id", deleteDocument);

export default router;
