CREATE TABLE "review_item_history" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "item_id" UUID NOT NULL,
  "from_status" "CandidateRecordStatus" NOT NULL,
  "to_status" "CandidateRecordStatus" NOT NULL,
  "snapshot" JSONB NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "review_item_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "review_item_history_user_id_kind_item_id_created_at_idx"
  ON "review_item_history"("user_id", "kind", "item_id", "created_at");

ALTER TABLE "review_item_history"
  ADD CONSTRAINT "review_item_history_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
