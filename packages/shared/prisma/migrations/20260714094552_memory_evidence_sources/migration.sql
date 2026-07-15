-- CreateTable
CREATE TABLE "memory_sources" (
    "memory_id" UUID NOT NULL,
    "evidence_fragment_id" UUID NOT NULL,
    "role" "EventSourceRole" NOT NULL DEFAULT 'supporting',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_sources_pkey" PRIMARY KEY ("memory_id","evidence_fragment_id")
);

-- CreateIndex
CREATE INDEX "memory_sources_evidence_fragment_id_idx" ON "memory_sources"("evidence_fragment_id");

-- AddForeignKey
ALTER TABLE "memory_sources" ADD CONSTRAINT "memory_sources_memory_id_fkey" FOREIGN KEY ("memory_id") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_sources" ADD CONSTRAINT "memory_sources_evidence_fragment_id_fkey" FOREIGN KEY ("evidence_fragment_id") REFERENCES "evidence_fragments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
