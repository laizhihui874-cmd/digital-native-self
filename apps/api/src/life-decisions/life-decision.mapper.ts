import type {
  DecisionEvidence,
  DecisionPath,
  ExternalSource,
  LifeDecision,
  LifeDecisionDetail,
} from "@digital-self/shared";
import type {
  DecisionEvidence as PrismaDecisionEvidence,
  DecisionPath as PrismaDecisionPath,
  ExternalSource as PrismaExternalSource,
  LifeDecision as PrismaLifeDecision,
} from "@prisma/client";

export type LifeDecisionDetailResponse = LifeDecisionDetail & {
  evidenceItems: DecisionEvidence[];
};

type DecisionPathWithEvidence = PrismaDecisionPath & {
  evidenceItems: PrismaDecisionEvidence[];
};

type LifeDecisionWithRelations = PrismaLifeDecision & {
  paths: DecisionPathWithEvidence[];
  evidenceItems: PrismaDecisionEvidence[];
  externalSources: PrismaExternalSource[];
};

export function mapLifeDecision(record: PrismaLifeDecision): LifeDecision {
  return {
    id: record.id,
    userId: record.userId,
    title: record.title,
    description: record.description,
    deadline: record.deadline ? record.deadline.toISOString() : null,
    status: record.status,
    finalDecision: record.finalDecision,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function mapDecisionPath(record: PrismaDecisionPath): DecisionPath {
  return {
    id: record.id,
    decisionId: record.decisionId,
    title: record.title,
    description: record.description,
    benefits: mapStringArray(record.benefits),
    risks: mapStringArray(record.risks),
    currentScore: record.currentScore,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

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

export function mapLifeDecisionDetail(record: LifeDecisionWithRelations): LifeDecisionDetailResponse {
  return {
    ...mapLifeDecision(record),
    paths: record.paths.map((path) => ({
      ...mapDecisionPath(path),
      evidenceItems: path.evidenceItems.map(mapDecisionEvidence),
    })),
    evidenceItems: record.evidenceItems.map(mapDecisionEvidence),
    externalSources: record.externalSources.map(mapExternalSource),
  };
}

function mapExternalSource(record: PrismaExternalSource): ExternalSource {
  return {
    id: record.id,
    userId: record.userId,
    lifeDecisionId: record.lifeDecisionId,
    title: record.title,
    sourceSite: record.sourceSite,
    url: record.url,
    publishedAt: record.publishedAt ? record.publishedAt.toISOString() : null,
    fetchedAt: record.fetchedAt ? record.fetchedAt.toISOString() : null,
    summary: record.summary,
    relationToDecision: record.relationToDecision,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}
