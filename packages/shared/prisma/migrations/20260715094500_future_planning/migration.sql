ALTER TYPE "GraphEntityType" ADD VALUE 'goal';
ALTER TYPE "GraphEntityType" ADD VALUE 'plan';
ALTER TYPE "GraphEntityType" ADD VALUE 'milestone';
ALTER TYPE "GraphEntityType" ADD VALUE 'action';

CREATE TYPE "GoalStatus" AS ENUM ('draft', 'active', 'achieved', 'paused', 'abandoned');
CREATE TYPE "FuturePlanStatus" AS ENUM ('draft', 'active', 'completed', 'paused', 'abandoned');
CREATE TYPE "MilestoneStatus" AS ENUM ('planned', 'active', 'completed', 'missed');
CREATE TYPE "ActionItemStatus" AS ENUM ('todo', 'doing', 'done', 'cancelled');

CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "area" TEXT,
    "success_criteria" TEXT,
    "status" "GoalStatus" NOT NULL DEFAULT 'active',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "target_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "future_plans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "goal_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "FuturePlanStatus" NOT NULL DEFAULT 'active',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "future_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "milestones" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'planned',
    "due_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "action_items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "milestone_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ActionItemStatus" NOT NULL DEFAULT 'todo',
    "due_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "action_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "goals_user_id_status_target_date_idx" ON "goals"("user_id", "status", "target_date");
CREATE INDEX "future_plans_user_id_status_end_date_idx" ON "future_plans"("user_id", "status", "end_date");
CREATE INDEX "future_plans_goal_id_created_at_idx" ON "future_plans"("goal_id", "created_at");
CREATE INDEX "milestones_user_id_status_due_at_idx" ON "milestones"("user_id", "status", "due_at");
CREATE INDEX "milestones_plan_id_due_at_idx" ON "milestones"("plan_id", "due_at");
CREATE INDEX "action_items_user_id_status_due_at_idx" ON "action_items"("user_id", "status", "due_at");
CREATE INDEX "action_items_plan_id_created_at_idx" ON "action_items"("plan_id", "created_at");
CREATE INDEX "action_items_milestone_id_created_at_idx" ON "action_items"("milestone_id", "created_at");

ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "future_plans" ADD CONSTRAINT "future_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "future_plans" ADD CONSTRAINT "future_plans_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "future_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "future_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
