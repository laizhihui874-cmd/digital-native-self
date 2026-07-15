CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "DailyEntrySource" AS ENUM ('feishu', 'web', 'import');

-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('goal', 'ability', 'value', 'event', 'relationship', 'recurring_problem', 'decision');

-- CreateEnum
CREATE TYPE "MemoryStatus" AS ENUM ('candidate', 'confirmed', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "LifeDecisionStatus" AS ENUM ('active', 'decided', 'archived');

-- CreateEnum
CREATE TYPE "DecisionEvidenceType" AS ENUM ('support', 'against', 'neutral');

-- CreateEnum
CREATE TYPE "AbilityNodeOrigin" AS ENUM ('system', 'custom');

-- CreateEnum
CREATE TYPE "CandidateRecordStatus" AS ENUM ('candidate', 'confirmed', 'rejected');

-- CreateEnum
CREATE TYPE "AbilityEvidenceImpact" AS ENUM ('positive', 'negative', 'neutral');

-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('growth', 'emotional_drain', 'long_term_fit', 'communication_pressure');

-- CreateEnum
CREATE TYPE "CitationSourceType" AS ENUM ('daily_entry', 'external_link', 'imported_file', 'feishu_message', 'memory', 'event', 'project');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('work', 'study', 'emotion', 'decision', 'project', 'relationship', 'other');

-- CreateEnum
CREATE TYPE "ChangeActorType" AS ENUM ('user', 'ai');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('planned', 'active', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "ImportedFileType" AS ENUM ('pdf', 'word', 'txt', 'markdown');

-- CreateEnum
CREATE TYPE "ImportedFileSourceType" AS ENUM ('resume', 'history', 'other');

-- CreateEnum
CREATE TYPE "ToolCallStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "display_name" TEXT,
    "timezone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source" "DailyEntrySource" NOT NULL,
    "raw_content" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "structured_daily_reports" (
    "id" UUID NOT NULL,
    "daily_entry_id" UUID NOT NULL,
    "facts" JSONB NOT NULL,
    "emotions" JSONB NOT NULL,
    "work_items" JSONB NOT NULL,
    "feedback" JSONB NOT NULL,
    "growth_evidence" JSONB NOT NULL,
    "drain_sources" JSONB NOT NULL,
    "next_actions" JSONB NOT NULL,
    "decision_impact" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "structured_daily_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "memory_type" "MemoryType" NOT NULL,
    "content" TEXT NOT NULL,
    "source_citation_id" UUID,
    "status" "MemoryStatus" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "is_momentary_thought" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_versions" (
    "id" UUID NOT NULL,
    "memory_id" UUID NOT NULL,
    "previous_content" TEXT NOT NULL,
    "new_content" TEXT NOT NULL,
    "change_reason" TEXT,
    "changed_by" "ChangeActorType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "life_decisions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "deadline" TIMESTAMP(3),
    "status" "LifeDecisionStatus" NOT NULL,
    "final_decision" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "life_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_paths" (
    "id" UUID NOT NULL,
    "decision_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "benefits" JSONB NOT NULL,
    "risks" JSONB NOT NULL,
    "current_score" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decision_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_evidence" (
    "id" UUID NOT NULL,
    "decision_id" UUID NOT NULL,
    "path_id" UUID NOT NULL,
    "evidence_type" "DecisionEvidenceType" NOT NULL,
    "content" TEXT NOT NULL,
    "source_citation_id" UUID,
    "weight" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decision_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ability_nodes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "origin" "AbilityNodeOrigin" NOT NULL DEFAULT 'custom',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ability_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ability_evidence" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "ability_node_id" UUID NOT NULL,
    "source_citation_id" UUID,
    "content" TEXT NOT NULL,
    "impact" "AbilityEvidenceImpact" NOT NULL,
    "difficulty_score" INTEGER NOT NULL,
    "independence_score" INTEGER NOT NULL,
    "impact_score" INTEGER NOT NULL,
    "feedback_score" INTEGER NOT NULL,
    "recurrence_count" INTEGER NOT NULL DEFAULT 1,
    "status" "CandidateRecordStatus" NOT NULL DEFAULT 'candidate',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ability_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_ratings" (
    "id" UUID NOT NULL,
    "daily_entry_id" UUID NOT NULL,
    "metric_type" "MetricType" NOT NULL,
    "ai_score" INTEGER,
    "user_score" INTEGER,
    "final_score" INTEGER,
    "ai_reason" TEXT,
    "confirmed_by_user" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metric_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_citations" (
    "id" UUID NOT NULL,
    "source_type" "CitationSourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT,
    "excerpt" TEXT,
    "locator" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_citations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embeddings" (
    "id" UUID NOT NULL,
    "source_type" "CitationSourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "embedding_model" TEXT NOT NULL,
    "dimensions" INTEGER,
    "content_hash" TEXT NOT NULL,
    "vector" vector,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "role" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "status" "ProjectStatus" NOT NULL,
    "outcomes" JSONB NOT NULL,
    "resume_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_ability_evidence" (
    "project_id" UUID NOT NULL,
    "ability_evidence_id" UUID NOT NULL,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_ability_evidence_pkey" PRIMARY KEY ("project_id","ability_evidence_id")
);

-- CreateTable
CREATE TABLE "imported_files" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" "ImportedFileType" NOT NULL,
    "source_type" "ImportedFileSourceType" NOT NULL,
    "storage_path" TEXT,
    "parsed_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imported_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_sources" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "life_decision_id" UUID,
    "title" TEXT NOT NULL,
    "source_site" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "fetched_at" TIMESTAMP(3),
    "summary" TEXT,
    "relation_to_decision" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_call_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "agent_name" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "input_summary" TEXT,
    "output_summary" TEXT,
    "status" "ToolCallStatus" NOT NULL,
    "latency_ms" INTEGER,
    "request_id" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_reviews" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "life_decision_id" UUID,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "progress_summary" TEXT,
    "ability_changes" JSONB NOT NULL,
    "emotion_patterns" JSONB NOT NULL,
    "goal_drift" TEXT,
    "next_week_suggestions" JSONB NOT NULL,
    "life_possibility_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emotion_patterns" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "weekly_review_id" UUID,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "dominant_emotions" JSONB NOT NULL,
    "triggers" JSONB NOT NULL,
    "patterns" JSONB NOT NULL,
    "decision_risk" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emotion_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "daily_entry_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "event_type" "EventType" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "primary_source_citation_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_entries_user_id_created_at_idx" ON "daily_entries"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "daily_entries_source_created_at_idx" ON "daily_entries"("source", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "structured_daily_reports_daily_entry_id_key" ON "structured_daily_reports"("daily_entry_id");

-- CreateIndex
CREATE INDEX "memories_user_id_memory_type_status_idx" ON "memories"("user_id", "memory_type", "status");

-- CreateIndex
CREATE INDEX "memories_expires_at_idx" ON "memories"("expires_at");

-- CreateIndex
CREATE INDEX "memory_versions_memory_id_created_at_idx" ON "memory_versions"("memory_id", "created_at");

-- CreateIndex
CREATE INDEX "life_decisions_user_id_status_deadline_idx" ON "life_decisions"("user_id", "status", "deadline");

-- CreateIndex
CREATE INDEX "decision_paths_decision_id_created_at_idx" ON "decision_paths"("decision_id", "created_at");

-- CreateIndex
CREATE INDEX "decision_evidence_decision_id_path_id_evidence_type_idx" ON "decision_evidence"("decision_id", "path_id", "evidence_type");

-- CreateIndex
CREATE INDEX "ability_nodes_user_id_parent_id_idx" ON "ability_nodes"("user_id", "parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "ability_nodes_user_id_parent_id_name_key" ON "ability_nodes"("user_id", "parent_id", "name");

-- CreateIndex
CREATE INDEX "ability_evidence_user_id_ability_node_id_status_idx" ON "ability_evidence"("user_id", "ability_node_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "metric_ratings_daily_entry_id_metric_type_key" ON "metric_ratings"("daily_entry_id", "metric_type");

-- CreateIndex
CREATE INDEX "source_citations_source_type_source_id_idx" ON "source_citations"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "embeddings_content_hash_idx" ON "embeddings"("content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "embeddings_source_type_source_id_chunk_index_key" ON "embeddings"("source_type", "source_id", "chunk_index");

-- CreateIndex
CREATE INDEX "projects_user_id_status_idx" ON "projects"("user_id", "status");

-- CreateIndex
CREATE INDEX "imported_files_user_id_source_type_created_at_idx" ON "imported_files"("user_id", "source_type", "created_at");

-- CreateIndex
CREATE INDEX "external_sources_user_id_fetched_at_idx" ON "external_sources"("user_id", "fetched_at");

-- CreateIndex
CREATE INDEX "external_sources_life_decision_id_created_at_idx" ON "external_sources"("life_decision_id", "created_at");

-- CreateIndex
CREATE INDEX "tool_call_logs_agent_name_status_created_at_idx" ON "tool_call_logs"("agent_name", "status", "created_at");

-- CreateIndex
CREATE INDEX "tool_call_logs_request_id_idx" ON "tool_call_logs"("request_id");

-- CreateIndex
CREATE INDEX "weekly_reviews_life_decision_id_period_start_idx" ON "weekly_reviews"("life_decision_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_reviews_user_id_period_start_period_end_key" ON "weekly_reviews"("user_id", "period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "emotion_patterns_weekly_review_id_key" ON "emotion_patterns"("weekly_review_id");

-- CreateIndex
CREATE INDEX "emotion_patterns_weekly_review_id_idx" ON "emotion_patterns"("weekly_review_id");

-- CreateIndex
CREATE UNIQUE INDEX "emotion_patterns_user_id_period_start_period_end_key" ON "emotion_patterns"("user_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "events_user_id_occurred_at_idx" ON "events"("user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "events_daily_entry_id_created_at_idx" ON "events"("daily_entry_id", "created_at");

-- AddForeignKey
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structured_daily_reports" ADD CONSTRAINT "structured_daily_reports_daily_entry_id_fkey" FOREIGN KEY ("daily_entry_id") REFERENCES "daily_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_source_citation_id_fkey" FOREIGN KEY ("source_citation_id") REFERENCES "source_citations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_versions" ADD CONSTRAINT "memory_versions_memory_id_fkey" FOREIGN KEY ("memory_id") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "life_decisions" ADD CONSTRAINT "life_decisions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_paths" ADD CONSTRAINT "decision_paths_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "life_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_evidence" ADD CONSTRAINT "decision_evidence_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "life_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_evidence" ADD CONSTRAINT "decision_evidence_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "decision_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_evidence" ADD CONSTRAINT "decision_evidence_source_citation_id_fkey" FOREIGN KEY ("source_citation_id") REFERENCES "source_citations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ability_nodes" ADD CONSTRAINT "ability_nodes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ability_nodes" ADD CONSTRAINT "ability_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "ability_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ability_evidence" ADD CONSTRAINT "ability_evidence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ability_evidence" ADD CONSTRAINT "ability_evidence_ability_node_id_fkey" FOREIGN KEY ("ability_node_id") REFERENCES "ability_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ability_evidence" ADD CONSTRAINT "ability_evidence_source_citation_id_fkey" FOREIGN KEY ("source_citation_id") REFERENCES "source_citations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_ratings" ADD CONSTRAINT "metric_ratings_daily_entry_id_fkey" FOREIGN KEY ("daily_entry_id") REFERENCES "daily_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_ability_evidence" ADD CONSTRAINT "project_ability_evidence_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_ability_evidence" ADD CONSTRAINT "project_ability_evidence_ability_evidence_id_fkey" FOREIGN KEY ("ability_evidence_id") REFERENCES "ability_evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_files" ADD CONSTRAINT "imported_files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_sources" ADD CONSTRAINT "external_sources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_sources" ADD CONSTRAINT "external_sources_life_decision_id_fkey" FOREIGN KEY ("life_decision_id") REFERENCES "life_decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_call_logs" ADD CONSTRAINT "tool_call_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_life_decision_id_fkey" FOREIGN KEY ("life_decision_id") REFERENCES "life_decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emotion_patterns" ADD CONSTRAINT "emotion_patterns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emotion_patterns" ADD CONSTRAINT "emotion_patterns_weekly_review_id_fkey" FOREIGN KEY ("weekly_review_id") REFERENCES "weekly_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_daily_entry_id_fkey" FOREIGN KEY ("daily_entry_id") REFERENCES "daily_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_primary_source_citation_id_fkey" FOREIGN KEY ("primary_source_citation_id") REFERENCES "source_citations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
