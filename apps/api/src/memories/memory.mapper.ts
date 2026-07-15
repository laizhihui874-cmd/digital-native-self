import type { Memory, MemoryArchiveDetail } from "@digital-self/shared";
import type { Memory as PrismaMemory, Prisma } from "@prisma/client";

import { mapEvidenceArtifact, mapEvidenceFragment, mapEvidenceRevision } from "../evidence/evidence.mapper";

export const memoryArchiveInclude = {
  versions: { orderBy: { createdAt: "asc" as const } },
  evidenceSources: {
    include: { evidenceFragment: { include: { revision: { include: { artifact: true } } } } },
  },
} satisfies Prisma.MemoryInclude;

type MemoryArchiveRecord = Prisma.MemoryGetPayload<{ include: typeof memoryArchiveInclude }>;

export function mapMemory(record: PrismaMemory): Memory {
  return {
    id: record.id,
    userId: record.userId,
    memoryType: record.memoryType,
    content: record.content,
    sourceCitationId: record.sourceCitationId,
    status: record.status,
    confidence: record.confidence,
    isMomentaryThought: record.isMomentaryThought,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function mapMemoryArchiveDetail(record: MemoryArchiveRecord): MemoryArchiveDetail {
  return {
    ...mapMemory(record),
    versions: record.versions.map((version) => ({
      id: version.id,
      memoryId: version.memoryId,
      previousContent: version.previousContent,
      newContent: version.newContent,
      changeReason: version.changeReason,
      changedBy: version.changedBy,
      createdAt: version.createdAt.toISOString(),
    })),
    evidenceSources: record.evidenceSources.map((source) => ({
      memoryId: source.memoryId,
      evidenceFragmentId: source.evidenceFragmentId,
      role: source.role,
      createdAt: source.createdAt.toISOString(),
      evidenceFragment: {
        ...mapEvidenceFragment(source.evidenceFragment as never),
        revision: {
          ...mapEvidenceRevision(source.evidenceFragment.revision as never),
          artifact: mapEvidenceArtifact(source.evidenceFragment.revision.artifact),
        },
      },
    })),
  };
}
