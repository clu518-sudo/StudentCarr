-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "headline" TEXT,
    "summary" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "preferred_roles" JSONB,
    "preferred_locations" JSONB,
    "work_authorization" TEXT,
    "salary_range" TEXT,
    "availability" TEXT,
    "links" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "education" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_profile_id" TEXT NOT NULL,
    "school" TEXT NOT NULL,
    "degree" TEXT,
    "field_of_study" TEXT,
    "start_date" TEXT,
    "end_date" TEXT,
    "grade" TEXT,
    "description" TEXT,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "education_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "user_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "work_experiences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_profile_id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "start_date" TEXT,
    "end_date" TEXT,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "achievements" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "work_experiences_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "user_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_profile_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "description" TEXT,
    "technologies" JSONB,
    "start_date" TEXT,
    "end_date" TEXT,
    "project_url" TEXT,
    "repository_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "projects_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "user_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_profile_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "issue_date" TEXT,
    "expiry_date" TEXT,
    "credential_id" TEXT,
    "credential_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "certifications_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "user_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_profile_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT,
    "category" TEXT,
    "years_of_experience" INTEGER,
    "keywords" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "skills_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "user_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "profile_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "stored_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "uploaded_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "profile_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX "user_profiles_user_id_idx" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX "education_user_profile_id_idx" ON "education"("user_profile_id");

-- CreateIndex
CREATE INDEX "work_experiences_user_profile_id_idx" ON "work_experiences"("user_profile_id");

-- CreateIndex
CREATE INDEX "projects_user_profile_id_idx" ON "projects"("user_profile_id");

-- CreateIndex
CREATE INDEX "certifications_user_profile_id_idx" ON "certifications"("user_profile_id");

-- CreateIndex
CREATE INDEX "skills_user_profile_id_idx" ON "skills"("user_profile_id");

-- CreateIndex
CREATE INDEX "profile_documents_user_id_idx" ON "profile_documents"("user_id");

-- CreateIndex
CREATE INDEX "profile_documents_document_type_idx" ON "profile_documents"("document_type");
