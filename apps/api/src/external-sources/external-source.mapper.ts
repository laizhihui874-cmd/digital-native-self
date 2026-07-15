import type { ExternalSource } from "@digital-self/shared";
import type { ExternalSource as PrismaExternalSource } from "@prisma/client";

export function mapExternalSource(record: PrismaExternalSource): ExternalSource {
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
