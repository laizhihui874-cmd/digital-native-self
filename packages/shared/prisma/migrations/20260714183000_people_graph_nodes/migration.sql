ALTER TYPE "GraphEntityType" ADD VALUE 'person';

CREATE TABLE "people" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT,
    "description" TEXT,
    "first_met_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "people_user_id_name_idx" ON "people"("user_id", "name");
ALTER TABLE "people" ADD CONSTRAINT "people_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
