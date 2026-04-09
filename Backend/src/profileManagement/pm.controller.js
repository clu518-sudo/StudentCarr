import multer from "multer";
import fs from "fs";
import {
  manualProfileSchema,
  deleteDocumentParamsSchema,
  uploadDocumentsSchema,
  uploadSingleDocumentSchema,
  validate,
} from "./pm.schemas.js";
import {
  getProfileForUser,
  upsertManualProfileForUser,
  listDocumentsForUser,
  uploadDocumentsForUser,
  uploadSingleDocumentForUser,
  deleteDocumentForUser,
  getDocumentForUser,
} from "./pm.service.js";
import { maxFileSizeBytes, removeFileSafe } from "./pm.storage.js";

const formatZodError = (error) => {
  if (!error?.issues) {
    return "Invalid request payload";
  }

  return error.issues
    .map((issue) => `${issue.path.join(".") || "field"}: ${issue.message}`)
    .join(", ");
};

const getProfile = async (req, res, next) => {
  try {
    const result = await getProfileForUser(req.user.id);
    return res.json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const updateManualProfile = async (req, res, next) => {
  try {
    const payload = validate(manualProfileSchema, req.body);
    await upsertManualProfileForUser(req.user.id, payload);
    const result = await getProfileForUser(req.user.id);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error.name === "ZodError") {
      return res
        .status(400)
        .json({ success: false, error: formatZodError(error) });
    }
    return next(error);
  }
};

const getDocuments = async (req, res, next) => {
  try {
    const documents = await listDocumentsForUser(req.user.id);
    return res.json({ success: true, data: { documents } });
  } catch (error) {
    return next(error);
  }
};

const uploadDocuments = async (req, res, next) => {
  try {
    const files = req.files || [];
    const rawDocumentTypes = req.body.documentTypes;
    const parsedDocumentTypes = Array.isArray(rawDocumentTypes)
      ? rawDocumentTypes
      : rawDocumentTypes
        ? [rawDocumentTypes]
        : [];

    const payload = validate(uploadDocumentsSchema, {
      documentTypes: parsedDocumentTypes,
      githubUrl: req.body.githubUrl || "",
    });

    const documents = await uploadDocumentsForUser(
      req.user.id,
      files,
      payload.documentTypes,
      payload.githubUrl || null,
    );

    return res.status(201).json({
      success: true,
      data: { documents },
    });
  } catch (error) {
    if (error.name === "ZodError") {
      await Promise.all((req.files || []).map((file) => removeFileSafe(file.path)));
      return res
        .status(400)
        .json({ success: false, error: formatZodError(error) });
    }
    return next(error);
  }
};

const uploadSingleDocument = async (req, res, next) => {
  try {
    const payload = validate(uploadSingleDocumentSchema, {
      documentType: req.body.documentType || "",
      githubUrl: req.body.githubUrl || "",
    });

    const document = await uploadSingleDocumentForUser(
      req.user.id,
      req.file,
      payload.documentType,
      payload.githubUrl || null,
    );

    return res.status(201).json({
      success: true,
      data: { document },
    });
  } catch (error) {
    if (error.name === "ZodError") {
      await removeFileSafe(req.file?.path);
      return res
        .status(400)
        .json({ success: false, error: formatZodError(error) });
    }
    return next(error);
  }
};

const deleteDocument = async (req, res, next) => {
  try {
    const params = validate(deleteDocumentParamsSchema, req.params);
    await deleteDocumentForUser(req.user.id, params.id);
    return res.json({
      success: true,
      data: { message: "Document deleted successfully" },
    });
  } catch (error) {
    if (error.name === "ZodError") {
      return res
        .status(400)
        .json({ success: false, error: formatZodError(error) });
    }
    return next(error);
  }
};

const downloadDocument = async (req, res, next) => {
  try {
    const params = validate(deleteDocumentParamsSchema, req.params);
    const document = await getDocumentForUser(req.user.id, params.id);

    if (!document.path || !fs.existsSync(document.path)) {
      const error = new Error("Stored document file was not found");
      error.statusCode = 404;
      throw error;
    }

    if (document.mimeType) {
      res.type(document.mimeType);
    }

    return res.download(document.path, document.originalName);
  } catch (error) {
    if (error.name === "ZodError") {
      return res
        .status(400)
        .json({ success: false, error: formatZodError(error) });
    }
    return next(error);
  }
};

const handleUploadError = (error, req, res, next) => {
  if (!error) {
    return next();
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: `Each file must be ${Math.floor(maxFileSizeBytes / (1024 * 1024))}MB or less`,
      });
    }

    return res.status(400).json({ success: false, error: error.message });
  }

  if (error.message === "Only PDF files are allowed") {
    return res.status(400).json({ success: false, error: error.message });
  }

  return next(error);
};

export {
  getProfile,
  updateManualProfile,
  getDocuments,
  uploadDocuments,
  uploadSingleDocument,
  deleteDocument,
  downloadDocument,
  handleUploadError,
};
