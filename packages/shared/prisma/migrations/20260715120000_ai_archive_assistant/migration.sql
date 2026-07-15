ALTER TYPE "CitationSourceType" ADD VALUE IF NOT EXISTS 'ability_evidence';
ALTER TYPE "CitationSourceType" ADD VALUE IF NOT EXISTS 'life_decision';
ALTER TYPE "CitationSourceType" ADD VALUE IF NOT EXISTS 'person';
ALTER TYPE "CitationSourceType" ADD VALUE IF NOT EXISTS 'goal';
ALTER TYPE "CitationSourceType" ADD VALUE IF NOT EXISTS 'plan';
ALTER TYPE "CitationSourceType" ADD VALUE IF NOT EXISTS 'milestone';
ALTER TYPE "CitationSourceType" ADD VALUE IF NOT EXISTS 'action';
ALTER TYPE "CitationSourceType" ADD VALUE IF NOT EXISTS 'weekly_review';
ALTER TYPE "CitationSourceType" ADD VALUE IF NOT EXISTS 'evidence_fragment';

CREATE TYPE "AiMessageRole" AS ENUM ('user', 'assistant');
CREATE TYPE "AiMessageStatus" AS ENUM ('completed', 'citation_warning');
CREATE TYPE "CitationConsumerType" AS ENUM ('ai_message', 'proposal', 'analysis');
CREATE TYPE "CitationUsePurpose" AS ENUM ('context', 'answer_support', 'answer_opposition');

ALTER TABLE "source_citations"
  ADD COLUMN "user_id" UUID,
  ADD COLUMN "source_version_id" TEXT,
  ADD COLUMN "content_hash" TEXT;

CREATE TABLE "ai_settings" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "base_url" TEXT NOT NULL,
  "fast_model" TEXT NOT NULL,
  "analysis_model" TEXT NOT NULL,
  "credential_ref" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "external_processing_consent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_conversations" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_messages" (
  "id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "role" "AiMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "model" TEXT,
  "status" "AiMessageStatus" NOT NULL DEFAULT 'completed',
  "error_message" TEXT,
  "input_tokens" INTEGER,
  "output_tokens" INTEGER,
  "total_tokens" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "citation_uses" (
  "id" UUID NOT NULL,
  "citation_id" UUID NOT NULL,
  "consumer_type" "CitationConsumerType" NOT NULL,
  "consumer_id" UUID NOT NULL,
  "purpose" "CitationUsePurpose" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "citation_uses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_settings_user_id_key" ON "ai_settings"("user_id");
CREATE INDEX "ai_conversations_user_id_updated_at_idx" ON "ai_conversations"("user_id", "updated_at");
CREATE INDEX "ai_messages_conversation_id_created_at_idx" ON "ai_messages"("conversation_id", "created_at");
CREATE UNIQUE INDEX "citation_uses_citation_id_consumer_type_consumer_id_purpose_key"
  ON "citation_uses"("citation_id", "consumer_type", "consumer_id", "purpose");
CREATE INDEX "citation_uses_consumer_type_consumer_id_idx" ON "citation_uses"("consumer_type", "consumer_id");
CREATE INDEX "source_citations_user_id_source_type_source_id_idx"
  ON "source_citations"("user_id", "source_type", "source_id");
CREATE INDEX "source_citations_content_hash_idx" ON "source_citations"("content_hash");

ALTER TABLE "ai_settings"
  ADD CONSTRAINT "ai_settings_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_conversations"
  ADD CONSTRAINT "ai_conversations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_messages"
  ADD CONSTRAINT "ai_messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "citation_uses"
  ADD CONSTRAINT "citation_uses_citation_id_fkey"
  FOREIGN KEY ("citation_id") REFERENCES "source_citations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "source_citations"
  ADD CONSTRAINT "source_citations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "source_citations" AS citation
SET "user_id" = entry."user_id"
FROM "daily_entries" AS entry
WHERE citation."user_id" IS NULL
  AND citation."source_type" = 'daily_entry'
  AND citation."source_id" = entry."id"::text;

UPDATE "source_citations" AS citation
SET "user_id" = memory."user_id"
FROM "memories" AS memory
WHERE citation."user_id" IS NULL
  AND citation."source_type" = 'memory'
  AND citation."source_id" = memory."id"::text;

UPDATE "source_citations" AS citation
SET "user_id" = event."user_id"
FROM "events" AS event
WHERE citation."user_id" IS NULL
  AND citation."source_type" = 'event'
  AND citation."source_id" = event."id"::text;

UPDATE "source_citations" AS citation
SET "user_id" = project."user_id"
FROM "projects" AS project
WHERE citation."user_id" IS NULL
  AND citation."source_type" = 'project'
  AND citation."source_id" = project."id"::text;

UPDATE "source_citations" AS citation
SET "user_id" = imported_file."user_id"
FROM "imported_files" AS imported_file
WHERE citation."user_id" IS NULL
  AND citation."source_type" = 'imported_file'
  AND citation."source_id" = imported_file."id"::text;

UPDATE "source_citations" AS citation
SET "user_id" = external_source."user_id"
FROM "external_sources" AS external_source
WHERE citation."user_id" IS NULL
  AND citation."source_type" = 'external_link'
  AND citation."source_id" = external_source."id"::text;

UPDATE "source_citations" AS citation
SET "user_id" = memory."user_id"
FROM "memories" AS memory
WHERE citation."user_id" IS NULL
  AND memory."source_citation_id" = citation."id";

UPDATE "source_citations" AS citation
SET "user_id" = event."user_id"
FROM "events" AS event
WHERE citation."user_id" IS NULL
  AND event."primary_source_citation_id" = citation."id";

UPDATE "source_citations" AS citation
SET "user_id" = evidence."user_id"
FROM "ability_evidence" AS evidence
WHERE citation."user_id" IS NULL
  AND evidence."source_citation_id" = citation."id";

UPDATE "source_citations" AS citation
SET "user_id" = decision."user_id"
FROM "decision_evidence" AS evidence
JOIN "life_decisions" AS decision ON decision."id" = evidence."decision_id"
WHERE citation."user_id" IS NULL
  AND evidence."source_citation_id" = citation."id";
