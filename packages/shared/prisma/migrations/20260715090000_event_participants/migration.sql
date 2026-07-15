CREATE TABLE "event_participants" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "role" TEXT,
    "description" TEXT,
    "evidence_fragment_id" UUID,
    "valid_from" TIMESTAMP(3),
    "valid_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "event_participants_event_id_created_at_idx" ON "event_participants"("event_id", "created_at");
CREATE INDEX "event_participants_person_id_created_at_idx" ON "event_participants"("person_id", "created_at");
CREATE INDEX "event_participants_evidence_fragment_id_idx" ON "event_participants"("evidence_fragment_id");

ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_evidence_fragment_id_fkey" FOREIGN KEY ("evidence_fragment_id") REFERENCES "evidence_fragments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
