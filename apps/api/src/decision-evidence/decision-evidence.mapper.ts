import type { DecisionEvidence } from "@digital-self/shared";
import type { DecisionEvidence as PrismaDecisionEvidence } from "@prisma/client";

export function mapDecisionEvidence(record: PrismaDecisionEvidence): DecisionEvidence {
  return {
    id: record.id,
    decisionId: record.decisionId,
    pathId: record.pathId,
    evidenceType: record.evidenceType,
    content: record.content,
    sourceCitationId: record.sourceCitationId,
    weight: record.weight,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
