-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_profile_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "stored_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "parser_status" TEXT NOT NULL DEFAULT 'pending',
    "parsed_text" TEXT,
    "extraction_method" TEXT,
    "page_count" INTEGER,
    "parser_error" TEXT,
    "parser_started_at" DATETIME,
    "parser_completed_at" DATETIME,
    "parser_updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "profile_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_profile_documents" ("document_type", "id", "mime_type", "original_name", "path", "size", "status", "stored_name", "uploaded_at", "user_id") SELECT "document_type", "id", "mime_type", "original_name", "path", "size", "status", "stored_name", "uploaded_at", "user_id" FROM "profile_documents";
DROP TABLE "profile_documents";
ALTER TABLE "new_profile_documents" RENAME TO "profile_documents";
CREATE INDEX "profile_documents_user_id_idx" ON "profile_documents"("user_id");
CREATE INDEX "profile_documents_document_type_idx" ON "profile_documents"("document_type");
CREATE INDEX "profile_documents_parser_status_idx" ON "profile_documents"("parser_status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
