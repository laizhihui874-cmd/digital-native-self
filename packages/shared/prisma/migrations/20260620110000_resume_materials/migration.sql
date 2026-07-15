-- CreateEnum
CREATE TYPE "ResumeMaterialSourceType" AS ENUM (
  'ability_evidence',
  'project',
  'resume_document',
  'daily_entry',
  'manual'
);

-- CreateEnum
CREATE TYPE "ResumeMaterialType" AS ENUM (
  'achievement',
  'responsibility',
  'skill',
  'project_summary',
  'reflection',
  'other'
);

-- CreateEnum
CREATE TYPE "ResumeMaterialStatus" AS ENUM ('candidate', 'confirmed', 'rejected');

-- CreateTable
CREATE TABLE "resume_materials" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "source_type" "ResumeMaterialSourceType" NOT NULL,
  "source_id" UUID,
  "material_type" "ResumeMaterialType" NOT NULL,
  "content" TEXT NOT NULL,
  "suggested_bullet" TEXT,
  "status" "ResumeMaterialStatus" NOT NULL DEFAULT 'candidate',
  "confidence" DOUBLE PRECISION,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "resume_materials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resume_materials_user_id_status_created_at_idx"
  ON "resume_materials"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "resume_materials_user_id_source_type_created_at_idx"
  ON "resume_materials"("user_id", "source_type", "created_at");

-- CreateIndex
CREATE INDEX "resume_materials_user_id_source_type_source_id_idx"
  ON "resume_materials"("user_id", "source_type", "source_id");

-- AddForeignKey
ALTER TABLE "resume_materials"
  ADD CONSTRAINT "resume_materials_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
