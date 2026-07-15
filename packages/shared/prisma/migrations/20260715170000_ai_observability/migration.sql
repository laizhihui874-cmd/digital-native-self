ALTER TABLE "ai_messages"
  ADD COLUMN "latency_ms" INTEGER,
  ADD COLUMN "source_count" INTEGER,
  ADD COLUMN "sent_character_count" INTEGER,
  ADD COLUMN "citation_check_passed" BOOLEAN;

ALTER TABLE "tool_call_logs"
  ADD COLUMN "service" TEXT,
  ADD COLUMN "model" TEXT,
  ADD COLUMN "source_count" INTEGER,
  ADD COLUMN "sent_character_count" INTEGER,
  ADD COLUMN "input_tokens" INTEGER,
  ADD COLUMN "output_tokens" INTEGER,
  ADD COLUMN "total_tokens" INTEGER;
