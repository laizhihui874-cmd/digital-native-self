import type {
  EvidenceArtifact,
  EvidenceArtifactDetail,
  EvidenceFragment,
  EvidenceRevision,
} from "@digital-self/shared";
import type { Prisma } from "@prisma/client";

type ArtifactDetailRecord = Prisma.EvidenceArtifactGetPayload<{
  include: { revisions: { include: { fragments: true } } };
}>;

export function mapEvidenceArtifact(record: {
  id: string;
  userId: string;
  artifactType: EvidenceArtifact["artifactType"];
  title: string | null;
  originalUri: string | null;
  mimeType: string | null;
  privacyLevel: EvidenceArtifact["privacyLevel"];
  capturedAt: Date | null;
  createdAt: Date;
}): EvidenceArtifact {
  return {
    id: record.id,
    userId: record.userId,
    artifactType: record.artifactType,
    title: record.title,
    originalUri: record.originalUri,
    mimeType: record.mimeType,
    privacyLevel: record.privacyLevel,
    capturedAt: record.capturedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

export function mapEvidenceRevision(record: ArtifactDetailRecord["revisions"][number]): EvidenceRevision {
  return {
    id: record.id,
    artifactId: record.artifactId,
    revisionNumber: record.revisionNumber,
    revisionType: record.revisionType,
    contentHash: record.contentHash,
    content: record.content,
    storagePath: record.storagePath,
    parserVersion: record.parserVersion,
    createdAt: record.createdAt.toISOString(),
  };
}

export function mapEvidenceFragment(
  record: ArtifactDetailRecord["revisions"][number]["fragments"][number],
): EvidenceFragment {
  return {
    id: record.id,
    revisionId: record.revisionId,
    fragmentIndex: record.fragmentIndex,
    content: record.content,
    startOffset: record.startOffset,
    endOffset: record.endOffset,
    locator: (record.locator as Record<string, unknown> | null) ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

export function mapEvidenceArtifactDetail(record: ArtifactDetailRecord): EvidenceArtifactDetail {
  return {
    ...mapEvidenceArtifact(record),
    revisions: record.revisions.map((revision) => ({
      ...mapEvidenceRevision(revision),
      fragments: revision.fragments.map(mapEvidenceFragment),
    })),
  };
}
