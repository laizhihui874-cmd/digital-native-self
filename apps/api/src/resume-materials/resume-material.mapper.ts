import type { ResumeMaterial } from "@digital-self/shared";
import type { ResumeMaterial as PrismaResumeMaterial } from "@prisma/client";

export function mapResumeMaterial(record: PrismaResumeMaterial): ResumeMaterial {
  return {
    id: record.id,
    userId: record.userId,
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    materialType: record.materialType,
    content: record.content,
    suggestedBullet: record.suggestedBullet,
    status: record.status,
    confidence: record.confidence,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
