-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "auth_provider" TEXT NOT NULL DEFAULT 'password',
    "google_sub" TEXT,
    "full_name" TEXT,
    "is_email_verified" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT NOT NULL DEFAULT 'user',
    "chat_history_clears" INTEGER NOT NULL DEFAULT 0,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "demo_expires_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_users" ("auth_provider", "chat_history_clears", "created_at", "email", "full_name", "google_sub", "id", "is_email_verified", "password_hash", "role", "updated_at") SELECT "auth_provider", "chat_history_clears", "created_at", "email", "full_name", "google_sub", "id", "is_email_verified", "password_hash", "role", "updated_at" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_google_sub_key" ON "users"("google_sub");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
