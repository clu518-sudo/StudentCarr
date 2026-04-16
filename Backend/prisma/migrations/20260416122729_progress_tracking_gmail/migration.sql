-- CreateTable
CREATE TABLE "gmail_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "google_sub" TEXT NOT NULL,
    "google_email" TEXT NOT NULL,
    "display_name" TEXT,
    "scope" TEXT,
    "access_token_encrypted" TEXT,
    "refresh_token_encrypted" TEXT,
    "token_type" TEXT,
    "expires_at" DATETIME,
    "connected_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_verified_at" DATETIME,
    "last_synced_at" DATETIME,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "gmail_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gmail_oauth_states" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "state_hash" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gmail_oauth_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gmail_sync_states" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gmail_account_id" TEXT NOT NULL,
    "last_sync_status" TEXT NOT NULL DEFAULT 'idle',
    "last_sync_started_at" DATETIME,
    "last_sync_completed_at" DATETIME,
    "last_sync_error" TEXT,
    "first_sync_completed_at" DATETIME,
    "last_history_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "gmail_sync_states_gmail_account_id_fkey" FOREIGN KEY ("gmail_account_id") REFERENCES "gmail_accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "progress_applications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "gmail_account_id" TEXT,
    "company_name" TEXT NOT NULL,
    "company_name_normalized" TEXT NOT NULL,
    "position_title" TEXT NOT NULL,
    "position_title_normalized" TEXT NOT NULL,
    "contact_email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'under_review',
    "status_source_email_id" TEXT,
    "last_updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "progress_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "progress_applications_gmail_account_id_fkey" FOREIGN KEY ("gmail_account_id") REFERENCES "gmail_accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "progress_emails" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "gmail_account_id" TEXT NOT NULL,
    "application_id" TEXT,
    "gmail_message_id" TEXT NOT NULL,
    "gmail_thread_id" TEXT,
    "gmail_history_id" TEXT,
    "subject" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "sender_email" TEXT,
    "recipients" JSONB,
    "cc_recipients" JSONB,
    "bcc_recipients" JSONB,
    "snippet" TEXT,
    "label_ids" JSONB,
    "raw_headers" JSONB,
    "raw_body_text" TEXT,
    "raw_body_html" TEXT,
    "received_at" DATETIME,
    "sent_at" DATETIME,
    "is_unread" BOOLEAN NOT NULL DEFAULT true,
    "is_relevant" BOOLEAN,
    "processing_stage" TEXT NOT NULL DEFAULT 'discovered',
    "ai_processed_at" DATETIME,
    "needs_reply_draft" BOOLEAN NOT NULL DEFAULT false,
    "reply_required_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "progress_emails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "progress_emails_gmail_account_id_fkey" FOREIGN KEY ("gmail_account_id") REFERENCES "gmail_accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "progress_emails_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "progress_applications" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "progress_email_intelligence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email_id" TEXT NOT NULL,
    "summary" TEXT,
    "intent" TEXT NOT NULL DEFAULT 'unknown',
    "company_name" TEXT,
    "position_title" TEXT,
    "contact_email" TEXT,
    "confidence" REAL,
    "needs_reply_draft" BOOLEAN NOT NULL DEFAULT false,
    "suggested_application_status" TEXT,
    "review_notes" TEXT,
    "extracted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "progress_email_intelligence_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "progress_emails" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "progress_email_replies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "email_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'drafted',
    "draft_text" TEXT NOT NULL,
    "reviewed_text" TEXT,
    "sent_message_id" TEXT,
    "sent_thread_id" TEXT,
    "error_message" TEXT,
    "confirmed_at" DATETIME,
    "sent_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "progress_email_replies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "progress_email_replies_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "progress_emails" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "gmail_accounts_user_id_key" ON "gmail_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "gmail_accounts_google_sub_key" ON "gmail_accounts"("google_sub");

-- CreateIndex
CREATE INDEX "gmail_accounts_google_email_idx" ON "gmail_accounts"("google_email");

-- CreateIndex
CREATE UNIQUE INDEX "gmail_oauth_states_state_hash_key" ON "gmail_oauth_states"("state_hash");

-- CreateIndex
CREATE INDEX "gmail_oauth_states_user_id_idx" ON "gmail_oauth_states"("user_id");

-- CreateIndex
CREATE INDEX "gmail_oauth_states_expires_at_idx" ON "gmail_oauth_states"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "gmail_sync_states_gmail_account_id_key" ON "gmail_sync_states"("gmail_account_id");

-- CreateIndex
CREATE INDEX "progress_applications_user_id_status_idx" ON "progress_applications"("user_id", "status");

-- CreateIndex
CREATE INDEX "progress_applications_gmail_account_id_idx" ON "progress_applications"("gmail_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "progress_applications_user_id_company_name_normalized_position_title_normalized_key" ON "progress_applications"("user_id", "company_name_normalized", "position_title_normalized");

-- CreateIndex
CREATE INDEX "progress_emails_user_id_application_id_idx" ON "progress_emails"("user_id", "application_id");

-- CreateIndex
CREATE INDEX "progress_emails_gmail_account_id_received_at_idx" ON "progress_emails"("gmail_account_id", "received_at");

-- CreateIndex
CREATE INDEX "progress_emails_gmail_thread_id_idx" ON "progress_emails"("gmail_thread_id");

-- CreateIndex
CREATE UNIQUE INDEX "progress_emails_gmail_account_id_gmail_message_id_key" ON "progress_emails"("gmail_account_id", "gmail_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "progress_email_intelligence_email_id_key" ON "progress_email_intelligence"("email_id");

-- CreateIndex
CREATE INDEX "progress_email_intelligence_intent_idx" ON "progress_email_intelligence"("intent");

-- CreateIndex
CREATE INDEX "progress_email_replies_user_id_status_idx" ON "progress_email_replies"("user_id", "status");

-- CreateIndex
CREATE INDEX "progress_email_replies_email_id_created_at_idx" ON "progress_email_replies"("email_id", "created_at");
