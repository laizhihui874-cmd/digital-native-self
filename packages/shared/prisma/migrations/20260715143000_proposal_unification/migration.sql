CREATE TYPE "ProposalType" AS ENUM ('event', 'memory', 'person', 'relation', 'ability_evidence', 'plan', 'other');
CREATE TYPE "ProposalOrigin" AS ENUM ('manual', 'ai', 'migration');

CREATE TABLE "proposals" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "proposal_type" "ProposalType" NOT NULL,
  "status" "CandidateRecordStatus" NOT NULL DEFAULT 'candidate',
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "payload" JSONB NOT NULL,
  "evidence_fragment_id" UUID,
  "confidence" DOUBLE PRECISION,
  "origin" "ProposalOrigin" NOT NULL DEFAULT 'manual',
  "reviewed_at" TIMESTAMP(3),
  "applied_entity_type" TEXT,
  "applied_entity_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "proposal_reviews" (
  "id" UUID NOT NULL,
  "proposal_id" UUID NOT NULL,
  "from_status" "CandidateRecordStatus" NOT NULL,
  "to_status" "CandidateRecordStatus" NOT NULL,
  "actor" "ChangeActorType" NOT NULL DEFAULT 'user',
  "snapshot" JSONB NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "proposal_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "proposals_user_id_status_created_at_idx" ON "proposals"("user_id", "status", "created_at");
CREATE INDEX "proposals_user_id_proposal_type_status_idx" ON "proposals"("user_id", "proposal_type", "status");
CREATE INDEX "proposals_evidence_fragment_id_idx" ON "proposals"("evidence_fragment_id");
CREATE INDEX "proposals_applied_entity_type_applied_entity_id_idx" ON "proposals"("applied_entity_type", "applied_entity_id");
CREATE INDEX "proposal_reviews_proposal_id_created_at_idx" ON "proposal_reviews"("proposal_id", "created_at");

ALTER TABLE "proposals"
  ADD CONSTRAINT "proposals_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proposals"
  ADD CONSTRAINT "proposals_evidence_fragment_id_fkey"
  FOREIGN KEY ("evidence_fragment_id") REFERENCES "evidence_fragments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "proposal_reviews"
  ADD CONSTRAINT "proposal_reviews_proposal_id_fkey"
  FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "proposals" (
  "id", "user_id", "proposal_type", "status", "title", "summary", "payload",
  "evidence_fragment_id", "confidence", "origin", "reviewed_at",
  "applied_entity_type", "applied_entity_id", "created_at", "updated_at"
)
SELECT
  candidate."id",
  candidate."user_id",
  'event'::"ProposalType",
  candidate."status",
  candidate."title",
  candidate."description",
  jsonb_build_object(
    'eventType', candidate."event_type",
    'occurredAt', to_char(candidate."occurred_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'timePrecision', candidate."time_precision",
    'description', candidate."description"
  ),
  candidate."evidence_fragment_id",
  candidate."confidence",
  'migration'::"ProposalOrigin",
  candidate."reviewed_at",
  CASE WHEN candidate."confirmed_event_id" IS NULL THEN NULL ELSE 'event' END,
  candidate."confirmed_event_id",
  candidate."created_at",
  candidate."updated_at"
FROM "event_candidates" AS candidate
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "proposal_reviews" (
  "id", "proposal_id", "from_status", "to_status", "actor", "snapshot", "note", "created_at"
)
SELECT
  gen_random_uuid(),
  proposal."id",
  'candidate'::"CandidateRecordStatus",
  proposal."status",
  'user'::"ChangeActorType",
  proposal."payload",
  '从旧事件候选迁移的审核结果',
  COALESCE(proposal."reviewed_at", proposal."updated_at")
FROM "proposals" AS proposal
WHERE proposal."origin" = 'migration'
  AND proposal."status" <> 'candidate';
