import type { AbilityEvidence } from "@digital-self/shared";
import type { AbilityEvidence as PrismaAbilityEvidence } from "@prisma/client";

export function mapAbilityEvidence(record: PrismaAbilityEvidence): AbilityEvidence {
  return {
    id: record.id,
    userId: record.userId,
    abilityNodeId: record.abilityNodeId,
    sourceCitationId: record.sourceCitationId,
    content: record.content,
    impact: record.impact,
    difficultyScore: record.difficultyScore,
    independenceScore: record.independenceScore,
    impactScore: record.impactScore,
    feedbackScore: record.feedbackScore,
    recurrenceCount: record.recurrenceCount,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
