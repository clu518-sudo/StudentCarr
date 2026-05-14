-- RedefineTable
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
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_users" ("created_at", "email", "full_name", "id", "is_email_verified", "password_hash", "updated_at")
SELECT "created_at", "email", "full_name", "id", "is_email_verified", "password_hash", "updated_at" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_google_sub_key" ON "users"("google_sub");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateTable
CREATE TABLE "auth_oauth_states" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "state_hash" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_oauth_states_state_hash_key" ON "auth_oauth_states"("state_hash");

-- CreateIndex
CREATE INDEX "auth_oauth_states_expires_at_idx" ON "auth_oauth_states"("expires_at");
