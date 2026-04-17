-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_progress_emails" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "gmail_account_id" TEXT NOT NULL,
    "application_id" TEXT,
    "gmail_message_id" TEXT NOT NULL,
    "gmail_thread_id" TEXT,
    "gmail_history_id" TEXT,
    "rfc_message_id" TEXT,
    "in_reply_to" TEXT,
    "references_header" JSONB,
    "parent_email_id" TEXT,
    "thread_position" INTEGER,
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
    CONSTRAINT "progress_emails_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "progress_applications" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "progress_emails_parent_email_id_fkey" FOREIGN KEY ("parent_email_id") REFERENCES "progress_emails" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_progress_emails" ("ai_processed_at", "application_id", "bcc_recipients", "cc_recipients", "created_at", "gmail_account_id", "gmail_history_id", "gmail_message_id", "gmail_thread_id", "id", "is_relevant", "is_unread", "label_ids", "needs_reply_draft", "processing_stage", "raw_body_html", "raw_body_text", "raw_headers", "received_at", "recipients", "reply_required_at", "sender", "sender_email", "sent_at", "snippet", "subject", "updated_at", "user_id") SELECT "ai_processed_at", "application_id", "bcc_recipients", "cc_recipients", "created_at", "gmail_account_id", "gmail_history_id", "gmail_message_id", "gmail_thread_id", "id", "is_relevant", "is_unread", "label_ids", "needs_reply_draft", "processing_stage", "raw_body_html", "raw_body_text", "raw_headers", "received_at", "recipients", "reply_required_at", "sender", "sender_email", "sent_at", "snippet", "subject", "updated_at", "user_id" FROM "progress_emails";
DROP TABLE "progress_emails";
ALTER TABLE "new_progress_emails" RENAME TO "progress_emails";
CREATE INDEX "progress_emails_user_id_application_id_idx" ON "progress_emails"("user_id", "application_id");
CREATE INDEX "progress_emails_gmail_account_id_received_at_idx" ON "progress_emails"("gmail_account_id", "received_at");
CREATE INDEX "progress_emails_gmail_thread_id_idx" ON "progress_emails"("gmail_thread_id");
CREATE INDEX "progress_emails_rfc_message_id_idx" ON "progress_emails"("rfc_message_id");
CREATE INDEX "progress_emails_parent_email_id_idx" ON "progress_emails"("parent_email_id");
CREATE INDEX "progress_emails_application_id_parent_email_id_idx" ON "progress_emails"("application_id", "parent_email_id");
CREATE UNIQUE INDEX "progress_emails_gmail_account_id_gmail_message_id_key" ON "progress_emails"("gmail_account_id", "gmail_message_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
