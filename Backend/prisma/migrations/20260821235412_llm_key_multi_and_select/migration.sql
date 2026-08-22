-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_user_llm_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Untitled',
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "model" TEXT,
    "base_url" TEXT,
    "encrypted_key" TEXT NOT NULL,
    "last_four" TEXT NOT NULL,
    "is_selected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_llm_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_user_llm_keys" ("base_url", "created_at", "encrypted_key", "id", "last_four", "model", "provider", "updated_at", "user_id") SELECT "base_url", "created_at", "encrypted_key", "id", "last_four", "model", "provider", "updated_at", "user_id" FROM "user_llm_keys";
DROP TABLE "user_llm_keys";
ALTER TABLE "new_user_llm_keys" RENAME TO "user_llm_keys";
CREATE INDEX "user_llm_keys_user_id_idx" ON "user_llm_keys"("user_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
