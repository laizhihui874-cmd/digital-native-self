import type { EventCandidateDetail, EventDetail, EventProposalPayload } from "@digital-self/shared";
import type { Prisma } from "@prisma/client";

import { mapEvidenceArtifact, mapEvidenceFragment, mapEvidenceRevision } from "../evidence/evidence.mapper";

export const eventProposalInclude = {
  evidenceFragment: { include: { revision: { include: { artifact: true } } } },
  reviews: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.ProposalInclude;

export type EventProposalRecord = Prisma.ProposalGetPayload<{ include: typeof eventProposalInclude }>;

export function parseEventProposalPayload(payload: Prisma.JsonValue): EventProposalPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Event proposal payload is not an object.");
  }
  const value = payload as Record<string, Prisma.JsonValue>;
  if (typeof value.eventType !== "string" || typeof value.occurredAt !== "string" || typeof value.timePrecision !== "string") {
    throw new Error("Event proposal payload is missing required fields.");
  }
  return {
    eventType: value.eventType as EventProposalPayload["eventType"],
    occurredAt: value.occurredAt,
    timePrecision: value.timePrecision as EventProposalPayload["timePrecision"],
    description: typeof value.description === "string" ? value.description : null,
  };
}

export function mapEventProposalDetail(record: EventProposalRecord, confirmedEvent?: EventDetail | null): EventCandidateDetail {
  if (record.proposalType !== "event" || !record.evidenceFragment) {
    throw new Error(`Proposal ${record.id} is not a source-backed event proposal.`);
  }
  const payload = parseEventProposalPayload(record.payload);
  return {
    id: record.id,
    userId: record.userId,
    evidenceFragmentId: record.evidenceFragment.id,
    title: record.title,
    description: record.summary ?? payload.description ?? null,
    eventType: payload.eventType,
    occurredAt: new Date(payload.occurredAt).toISOString(),
    timePrecision: payload.timePrecision,
    status: record.status,
    confidence: record.confidence,
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
    confirmedEventId: record.appliedEntityType === "event" ? record.appliedEntityId : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    evidenceFragment: {
      ...mapEvidenceFragment(record.evidenceFragment),
      revision: {
        ...mapEvidenceRevision(record.evidenceFragment.revision as never),
        artifact: mapEvidenceArtifact(record.evidenceFragment.revision.artifact),
      },
    },
    confirmedEvent: confirmedEvent ?? null,
  };
}
