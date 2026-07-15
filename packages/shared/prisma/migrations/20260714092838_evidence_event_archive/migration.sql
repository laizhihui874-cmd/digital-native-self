-- CreateEnum
CREATE TYPE "EvidenceArtifactType" AS ENUM ('daily_entry', 'pasted_text', 'uploaded_file', 'external_snapshot', 'feishu_message');

-- CreateEnum
CREATE TYPE "EvidenceRevisionType" AS ENUM ('original', 'parsed');

-- CreateEnum
CREATE TYPE "EvidencePrivacyLevel" AS ENUM ('private', 'sensitive', 'restricted');

-- CreateEnum
CREATE TYPE "EventTimePrecision" AS ENUM ('exact', 'day', 'month', 'year', 'approximate', 'unknown');

-- CreateEnum
CREATE TYPE "EventRecordStatus" AS ENUM ('confirmed', 'disputed');

-- CreateEnum
CREATE TYPE "EventSourceRole" AS ENUM ('primary', 'supporting');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "ended_at" TIMESTAMP(3),
ADD COLUMN     "record_status" "EventRecordStatus" NOT NULL DEFAULT 'confirmed',
ADD COLUMN     "time_precision" "EventTimePrecision" NOT NULL DEFAULT 'unknown';

-- CreateTable
CREATE TABLE "evidence_artifacts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "artifact_type" "EvidenceArtifactType" NOT NULL,
    "title" TEXT,
    "original_uri" TEXT,
    "mime_type" TEXT,
    "privacy_level" "EvidencePrivacyLevel" NOT NULL DEFAULT 'private',
    "captured_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_revisions" (
    "id" UUID NOT NULL,
    "artifact_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "revision_type" "EvidenceRevisionType" NOT NULL,
    "content_hash" TEXT NOT NULL,
    "content" TEXT,
    "storage_path" TEXT,
    "parser_version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_fragments" (
    "id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "fragment_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "start_offset" INTEGER,
    "end_offset" INTEGER,
    "locator" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_fragments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_candidates" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "evidence_fragment_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "event_type" "EventType" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "time_precision" "EventTimePrecision" NOT NULL DEFAULT 'unknown',
    "status" "CandidateRecordStatus" NOT NULL DEFAULT 'candidate',
    "confidence" DOUBLE PRECISION,
    "reviewed_at" TIMESTAMP(3),
    "confirmed_event_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_revisions" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "event_type" "EventType" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "time_precision" "EventTimePrecision" NOT NULL,
    "record_status" "EventRecordStatus" NOT NULL,
    "change_reason" TEXT,
    "changed_by" "ChangeActorType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_sources" (
    "event_id" UUID NOT NULL,
    "evidence_fragment_id" UUID NOT NULL,
    "role" "EventSourceRole" NOT NULL DEFAULT 'supporting',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_sources_pkey" PRIMARY KEY ("event_id","evidence_fragment_id")
);

-- CreateIndex
CREATE INDEX "evidence_artifacts_user_id_captured_at_idx" ON "evidence_artifacts"("user_id", "captured_at");

-- CreateIndex
CREATE INDEX "evidence_artifacts_user_id_artifact_type_created_at_idx" ON "evidence_artifacts"("user_id", "artifact_type", "created_at");

-- CreateIndex
CREATE INDEX "evidence_revisions_content_hash_idx" ON "evidence_revisions"("content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_revisions_artifact_id_revision_number_key" ON "evidence_revisions"("artifact_id", "revision_number");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_fragments_revision_id_fragment_index_key" ON "evidence_fragments"("revision_id", "fragment_index");

-- CreateIndex
CREATE UNIQUE INDEX "event_candidates_confirmed_event_id_key" ON "event_candidates"("confirmed_event_id");

-- CreateIndex
CREATE INDEX "event_candidates_user_id_status_created_at_idx" ON "event_candidates"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "event_candidates_evidence_fragment_id_idx" ON "event_candidates"("evidence_fragment_id");

-- CreateIndex
CREATE INDEX "event_revisions_event_id_created_at_idx" ON "event_revisions"("event_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "event_revisions_event_id_revision_number_key" ON "event_revisions"("event_id", "revision_number");

-- CreateIndex
CREATE INDEX "event_sources_evidence_fragment_id_idx" ON "event_sources"("evidence_fragment_id");

-- AddForeignKey
ALTER TABLE "evidence_artifacts" ADD CONSTRAINT "evidence_artifacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_revisions" ADD CONSTRAINT "evidence_revisions_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "evidence_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_fragments" ADD CONSTRAINT "evidence_fragments_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "evidence_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_candidates" ADD CONSTRAINT "event_candidates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_candidates" ADD CONSTRAINT "event_candidates_evidence_fragment_id_fkey" FOREIGN KEY ("evidence_fragment_id") REFERENCES "evidence_fragments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_candidates" ADD CONSTRAINT "event_candidates_confirmed_event_id_fkey" FOREIGN KEY ("confirmed_event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_revisions" ADD CONSTRAINT "event_revisions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_sources" ADD CONSTRAINT "event_sources_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_sources" ADD CONSTRAINT "event_sources_evidence_fragment_id_fkey" FOREIGN KEY ("evidence_fragment_id") REFERENCES "evidence_fragments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
