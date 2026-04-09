import fs from "fs";
import path from "path";
import multer from "multer";

const uploadDirectory = path.resolve(process.cwd(), "uploads", "profile");
const maxFileSizeBytes = 10 * 1024 * 1024;

const ensureUploadDirectory = () => {
  fs.mkdirSync(uploadDirectory, { recursive: true });
};

const toSafeFileName = (originalName) => {
  const extension = path.extname(originalName) || ".pdf";
  const baseName = path.basename(originalName, extension);
  const sanitized = baseName.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 60);
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}-${sanitized}${extension}`;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadDirectory();
    cb(null, uploadDirectory);
  },
  filename: (req, file, cb) => cb(null, toSafeFileName(file.originalname)),
});

const fileFilter = (req, file, cb) => {
  const isPdf =
    file.mimetype === "application/pdf" ||
    path.extname(file.originalname).toLowerCase() === ".pdf";

  if (!isPdf) {
    cb(new Error("Only PDF files are allowed"));
    return;
  }

  cb(null, true);
};

const uploadProfileDocuments = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileSizeBytes,
    files: 10,
  },
});

const removeFileSafe = async (targetPath) => {
  if (!targetPath) {
    return;
  }

  try {
    await fs.promises.unlink(targetPath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
};

export {
  uploadDirectory,
  maxFileSizeBytes,
  uploadProfileDocuments,
  removeFileSafe,
};
