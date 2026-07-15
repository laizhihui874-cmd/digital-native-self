CREATE TYPE "GraphEntityType" AS ENUM ('event', 'memory', 'project', 'ability', 'decision');
CREATE TYPE "GraphRelationStatus" AS ENUM ('candidate', 'confirmed', 'rejected');

CREATE TABLE "graph_relations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source_type" "GraphEntityType" NOT NULL,
    "source_id" UUID NOT NULL,
    "target_type" "GraphEntityType" NOT NULL,
    "target_id" UUID NOT NULL,
    "relation_type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "GraphRelationStatus" NOT NULL DEFAULT 'confirmed',
    "valid_from" TIMESTAMP(3),
    "valid_to" TIMESTAMP(3),
    "evidence_fragment_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "graph_relations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "graph_relations_user_id_status_created_at_idx" ON "graph_relations"("user_id", "status", "created_at");
CREATE INDEX "graph_relations_source_type_source_id_idx" ON "graph_relations"("source_type", "source_id");
CREATE INDEX "graph_relations_target_type_target_id_idx" ON "graph_relations"("target_type", "target_id");
ALTER TABLE "graph_relations" ADD CONSTRAINT "graph_relations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "graph_relations" ADD CONSTRAINT "graph_relations_evidence_fragment_id_fkey" FOREIGN KEY ("evidence_fragment_id") REFERENCES "evidence_fragments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
