import type {
  Event,
  EventCandidateDetail,
  EventDetail,
  EventParticipant,
  EventRevision,
} from "@digital-self/shared";
import type { Prisma } from "@prisma/client";

import { mapEvidenceArtifact, mapEvidenceFragment, mapEvidenceRevision } from "../evidence/evidence.mapper";

export const eventDetailInclude = {
  revisions: { orderBy: { revisionNumber: "asc" as const } },
  sources: {
    include: { evidenceFragment: { include: { revision: { include: { artifact: true } } } } },
  },
  participants: { orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] },
} satisfies Prisma.EventInclude;

export const candidateDetailInclude = {
  evidenceFragment: { include: { revision: { include: { artifact: true } } } },
  confirmedEvent: { include: eventDetailInclude },
} satisfies Prisma.EventCandidateInclude;

type EventRecord = Prisma.EventGetPayload<{ include: typeof eventDetailInclude }>;
type CandidateRecord = Prisma.EventCandidateGetPayload<{ include: typeof candidateDetailInclude }>;

export function mapEvent(record: EventRecord): Event {
  return {
    id: record.id,
    userId: record.userId,
    dailyEntryId: record.dailyEntryId,
    title: record.title,
    description: record.description,
    eventType: record.eventType,
    occurredAt: record.occurredAt.toISOString(),
    endedAt: record.endedAt?.toISOString() ?? null,
    timePrecision: record.timePrecision,
    recordStatus: record.recordStatus,
    primarySourceCitationId: record.primarySourceCitationId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapEventRevision(record: EventRecord["revisions"][number]): EventRevision {
  return {
    id: record.id,
    eventId: record.eventId,
    revisionNumber: record.revisionNumber,
    title: record.title,
    description: record.description,
    eventType: record.eventType,
    occurredAt: record.occurredAt.toISOString(),
    endedAt: record.endedAt?.toISOString() ?? null,
    timePrecision: record.timePrecision,
    recordStatus: record.recordStatus,
    changeReason: record.changeReason,
    changedBy: record.changedBy,
    createdAt: record.createdAt.toISOString(),
  };
}

export function mapEventDetail(record: EventRecord): EventDetail {
  return {
    ...mapEvent(record),
    revisions: record.revisions.map(mapEventRevision),
    sources: record.sources.map((source) => ({
      eventId: source.eventId,
      evidenceFragmentId: source.evidenceFragmentId,
      role: source.role,
      createdAt: source.createdAt.toISOString(),
      evidenceFragment: {
        ...mapEvidenceFragment(source.evidenceFragment),
        revision: {
          ...mapEvidenceRevision(source.evidenceFragment.revision as never),
          artifact: mapEvidenceArtifact(source.evidenceFragment.revision.artifact),
        },
      },
    })),
    participants: record.participants.map(mapEventParticipant),
  };
}

export function mapEventParticipant(record: {
  id: string;
  eventId: string;
  personId: string;
  role: string | null;
  description: string | null;
  evidenceFragmentId: string | null;
  validFrom: Date | null;
  validTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): EventParticipant {
  return {
    id: record.id,
    eventId: record.eventId,
    personId: record.personId,
    role: record.role ?? undefined,
    description: record.description ?? undefined,
    evidenceFragmentId: record.evidenceFragmentId ?? undefined,
    validFrom: record.validFrom?.toISOString(),
    validTo: record.validTo?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function mapEventCandidateDetail(record: CandidateRecord): EventCandidateDetail {
  return {
    id: record.id,
    userId: record.userId,
    evidenceFragmentId: record.evidenceFragmentId,
    title: record.title,
    description: record.description,
    eventType: record.eventType,
    occurredAt: record.occurredAt.toISOString(),
    timePrecision: record.timePrecision,
    status: record.status,
    confidence: record.confidence,
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
    confirmedEventId: record.confirmedEventId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    evidenceFragment: {
      ...mapEvidenceFragment(record.evidenceFragment),
      revision: {
        ...mapEvidenceRevision(record.evidenceFragment.revision as never),
        artifact: mapEvidenceArtifact(record.evidenceFragment.revision.artifact),
      },
    },
    confirmedEvent: record.confirmedEvent ? mapEventDetail(record.confirmedEvent) : null,
  };
}
