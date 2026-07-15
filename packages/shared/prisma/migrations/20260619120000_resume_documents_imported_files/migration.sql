-- CreateEnum
CREATE TYPE "ImportedFileParseStatus" AS ENUM ('pending', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "ResumeDocumentSource" AS ENUM ('pasted', 'uploaded');

-- AlterTable
ALTER TABLE "imported_files"
  ADD COLUMN IF NOT EXISTS "mime_type" TEXT,
  ADD COLUMN IF NOT EXISTS "file_size_bytes" INTEGER,
  ADD COLUMN IF NOT EXISTS "content_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "parse_status" "ImportedFileParseStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "parse_error" TEXT;

-- CreateTable
CREATE TABLE "resume_documents" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "imported_file_id" UUID,
  "source" "ResumeDocumentSource" NOT NULL,
  "title" TEXT,
  "content" TEXT NOT NULL,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "resume_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resume_documents_user_id_created_at_idx" ON "resume_documents"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "resume_documents_user_id_updated_at_idx" ON "resume_documents"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "resume_documents_imported_file_id_idx" ON "resume_documents"("imported_file_id");

-- CreateIndex
CREATE INDEX "imported_files_content_hash_idx" ON "imported_files"("content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "resume_documents_one_primary_per_user_idx"
  ON "resume_documents"("user_id")
  WHERE "is_primary" = true;

-- AddForeignKey
ALTER TABLE "resume_documents"
  ADD CONSTRAINT "resume_documents_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_documents"
  ADD CONSTRAINT "resume_documents_imported_file_id_fkey"
  FOREIGN KEY ("imported_file_id") REFERENCES "imported_files"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
