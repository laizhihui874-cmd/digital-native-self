import type {
  CreateEventCandidateRequest,
  CreateEventParticipantRequest,
  CreateMemoryCandidateFromEventRequest,
  EventCandidateDetail,
  EventDetail,
  EventParticipant,
  ListEventCandidatesResponse,
  ListEventsResponse,
  MemoryArchiveDetail,
  ReviewEventCandidateRequest,
  UpdateEventRequest,
  UpdateEventParticipantRequest,
} from "@digital-self/shared";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { DefaultIdentityService } from "../identity/default-identity.service";
import { PrismaService } from "../prisma/prisma.service";
import { mapMemoryArchiveDetail, memoryArchiveInclude } from "../memories/memory.mapper";
import { eventProposalInclude, mapEventProposalDetail, parseEventProposalPayload } from "./event-proposal.mapper";
import { eventDetailInclude, mapEventDetail, mapEventParticipant } from "./events.mapper";

@Injectable()
export class EventsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DefaultIdentityService) private readonly identity: DefaultIdentityService,
  ) {}

  async createCandidate(input: CreateEventCandidateRequest): Promise<EventCandidateDetail> {
    const userId = await this.identity.getCurrentUserId();
    const fragment = await this.prisma.evidenceFragment.findFirst({
      where: { id: input.evidenceFragmentId, revision: { artifact: { userId } } },
      select: { id: true },
    });
    if (!fragment) throw new NotFoundException(`EvidenceFragment ${input.evidenceFragmentId} was not found.`);

    const record = await this.prisma.proposal.create({
      data: {
        userId,
        proposalType: "event",
        evidenceFragmentId: input.evidenceFragmentId,
        title: input.title,
        summary: input.description,
        payload: {
          eventType: input.eventType,
          occurredAt: new Date(input.occurredAt).toISOString(),
          timePrecision: input.timePrecision ?? "unknown",
          description: input.description ?? null,
        },
        confidence: input.confidence,
        origin: "manual",
      },
      include: eventProposalInclude,
    });
    return mapEventProposalDetail(record);
  }

  async findCandidate(id: string): Promise<EventCandidateDetail> {
    const userId = await this.identity.getCurrentUserId();
    const record = await this.prisma.proposal.findFirst({
      where: { id, userId, proposalType: "event" },
      include: eventProposalInclude,
    });
    if (!record) throw new NotFoundException(`EventCandidate ${id} was not found.`);
    const confirmedEvent = record.appliedEntityType === "event" && record.appliedEntityId
      ? await this.prisma.event.findFirst({ where: { id: record.appliedEntityId, userId }, include: eventDetailInclude })
      : null;
    return mapEventProposalDetail(record, confirmedEvent ? mapEventDetail(confirmedEvent) : null);
  }

  async listCandidates(query: { limit?: number; offset?: number; status?: "candidate" | "confirmed" | "rejected" }): Promise<ListEventCandidatesResponse> {
    const userId = await this.identity.getCurrentUserId();
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const where = { userId, proposalType: "event" as const, ...(query.status ? { status: query.status } : {}) };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.proposal.count({ where }),
      this.prisma.proposal.findMany({
        where,
        include: eventProposalInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
        skip: offset,
      }),
    ]);
    const eventIds = items.flatMap((item) => item.appliedEntityType === "event" && item.appliedEntityId ? [item.appliedEntityId] : []);
    const events = eventIds.length > 0
      ? await this.prisma.event.findMany({ where: { id: { in: eventIds }, userId }, include: eventDetailInclude })
      : [];
    const eventsById = new Map(events.map((event) => [event.id, mapEventDetail(event)]));
    return {
      items: items.map((item) => mapEventProposalDetail(item, item.appliedEntityId ? eventsById.get(item.appliedEntityId) : null)),
      pagination: { total, limit, offset },
    };
  }

  async reviewCandidate(id: string, input: ReviewEventCandidateRequest): Promise<EventCandidateDetail> {
    const userId = await this.identity.getCurrentUserId();
    await this.prisma.$transaction(async (tx) => {
      const candidate = await tx.proposal.findFirst({ where: { id, userId, proposalType: "event" } });
      if (!candidate) throw new NotFoundException(`EventCandidate ${id} was not found.`);
      if (candidate.status !== "candidate") {
        throw new ConflictException(`EventCandidate ${id} has already been reviewed.`);
      }

      const payload = parseEventProposalPayload(candidate.payload);
      if (!candidate.evidenceFragmentId) {
        throw new ConflictException(`EventCandidate ${id} has no evidence fragment.`);
      }

      if (input.status === "rejected") {
        await tx.proposal.update({
          where: { id },
          data: { status: "rejected", reviewedAt: new Date() },
        });
        await tx.proposalReview.create({
          data: {
            proposalId: id,
            fromStatus: "candidate",
            toStatus: "rejected",
            actor: "user",
            snapshot: {
              eventType: payload.eventType,
              occurredAt: payload.occurredAt,
              timePrecision: payload.timePrecision,
              description: payload.description ?? null,
            },
            note: "用户拒绝事件候选",
          },
        });
        return;
      }

      const snapshot = {
        title: input.title ?? candidate.title,
        description: input.description === undefined ? candidate.summary ?? payload.description : input.description,
        eventType: input.eventType ?? payload.eventType,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(payload.occurredAt),
        timePrecision: input.timePrecision ?? payload.timePrecision,
        recordStatus: "confirmed" as const,
      };
      const event = await tx.event.create({
        data: {
          userId,
          ...snapshot,
          sources: { create: { evidenceFragmentId: candidate.evidenceFragmentId, role: "primary" } },
          revisions: {
            create: { revisionNumber: 1, ...snapshot, changedBy: "user", changeReason: "Confirmed event candidate" },
          },
        },
      });
      const nextPayload = {
        eventType: snapshot.eventType,
        occurredAt: snapshot.occurredAt.toISOString(),
        timePrecision: snapshot.timePrecision,
        description: snapshot.description ?? null,
      };
      await tx.proposal.update({
        where: { id },
        data: {
          title: snapshot.title,
          summary: snapshot.description,
          payload: nextPayload,
          status: "confirmed",
          reviewedAt: new Date(),
          appliedEntityType: "event",
          appliedEntityId: event.id,
        },
      });
      await tx.proposalReview.create({
        data: {
          proposalId: id,
          fromStatus: "candidate",
          toStatus: "confirmed",
          actor: "user",
          snapshot: nextPayload,
          note: "用户确认事件候选并创建正式事件",
        },
      });
    });
    return this.findCandidate(id);
  }

  async findEvent(id: string): Promise<EventDetail> {
    const userId = await this.identity.getCurrentUserId();
    const record = await this.prisma.event.findFirst({ where: { id, userId }, include: eventDetailInclude });
    if (!record) throw new NotFoundException(`Event ${id} was not found.`);
    return mapEventDetail(record);
  }

  async listEvents(query: { limit?: number; offset?: number; from?: string; to?: string }): Promise<ListEventsResponse> {
    const userId = await this.identity.getCurrentUserId();
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const where = {
      userId,
      ...(query.from || query.to
        ? { occurredAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } }
        : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        include: eventDetailInclude,
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: limit,
        skip: offset,
      }),
    ]);
    return { items: items.map(mapEventDetail), pagination: { total, limit, offset } };
  }

  async updateEvent(id: string, input: UpdateEventRequest): Promise<EventDetail> {
    const userId = await this.identity.getCurrentUserId();
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.event.findFirst({ where: { id, userId } });
      if (!current) throw new NotFoundException(`Event ${id} was not found.`);
      const revisionNumber = (await tx.eventRevision.count({ where: { eventId: id } })) + 1;
      const snapshot = {
        title: input.title ?? current.title,
        description: input.description === undefined ? current.description : input.description,
        eventType: input.eventType ?? current.eventType,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : current.occurredAt,
        endedAt: input.endedAt === undefined ? current.endedAt : input.endedAt ? new Date(input.endedAt) : null,
        timePrecision: input.timePrecision ?? current.timePrecision,
        recordStatus: input.recordStatus ?? current.recordStatus,
      };
      await tx.event.update({ where: { id }, data: snapshot });
      await tx.eventRevision.create({
        data: { eventId: id, revisionNumber, ...snapshot, changedBy: "user", changeReason: input.changeReason },
      });
      const updated = await tx.event.findUniqueOrThrow({ where: { id }, include: eventDetailInclude });
      return mapEventDetail(updated);
    });
  }

  async createMemoryCandidate(
    eventId: string,
    input: CreateMemoryCandidateFromEventRequest,
  ): Promise<MemoryArchiveDetail> {
    const userId = await this.identity.getCurrentUserId();
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findFirst({
        where: { id: eventId, userId },
        include: { sources: { orderBy: [{ role: "asc" }, { createdAt: "asc" }], take: 1 } },
      });
      if (!event) throw new NotFoundException(`Event ${eventId} was not found.`);
      const source = event.sources[0];
      if (!source) {
        throw new ConflictException("This event does not have an evidence fragment to support a memory candidate.");
      }
      const memory = await tx.memory.create({
        data: {
          userId,
          memoryType: input.memoryType,
          content: input.content,
          status: "candidate",
          confidence: input.confidence,
          evidenceSources: {
            create: { evidenceFragmentId: source.evidenceFragmentId, role: "primary" },
          },
          versions: {
            create: {
              previousContent: "",
              newContent: input.content,
              changeReason: `Candidate created from event ${eventId}`,
              changedBy: "user",
            },
          },
        },
        include: memoryArchiveInclude,
      });
      return mapMemoryArchiveDetail(memory);
    });
  }

  async listParticipants(eventId: string): Promise<EventParticipant[]> {
    const userId = await this.identity.getCurrentUserId();
    await this.requireOwnedEvent(eventId, userId);
    const records = await this.prisma.eventParticipant.findMany({
      where: { eventId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return records.map(mapEventParticipant);
  }

  async createParticipant(
    eventId: string,
    input: CreateEventParticipantRequest,
  ): Promise<EventParticipant> {
    const userId = await this.identity.getCurrentUserId();
    const [event, person] = await Promise.all([
      this.prisma.event.findFirst({
        where: { id: eventId, userId },
        include: { sources: { orderBy: [{ role: "asc" }, { createdAt: "asc" }], take: 1 } },
      }),
      this.prisma.person.findFirst({ where: { id: input.personId, userId }, select: { id: true } }),
    ]);
    if (!event) throw new NotFoundException(`Event ${eventId} was not found.`);
    if (!person) throw new NotFoundException(`Person ${input.personId} was not found.`);

    const evidenceFragmentId = input.evidenceFragmentId ?? event.sources[0]?.evidenceFragmentId;
    if (evidenceFragmentId) await this.requireOwnedEvidenceFragment(evidenceFragmentId, userId);
    assertValidPeriod(input.validFrom, input.validTo);

    return mapEventParticipant(await this.prisma.eventParticipant.create({
      data: {
        eventId,
        personId: input.personId,
        role: cleanOptionalText(input.role),
        description: cleanOptionalText(input.description),
        evidenceFragmentId,
        validFrom: input.validFrom ? new Date(input.validFrom) : null,
        validTo: input.validTo ? new Date(input.validTo) : null,
      },
    }));
  }

  async updateParticipant(
    id: string,
    input: UpdateEventParticipantRequest,
  ): Promise<EventParticipant> {
    const userId = await this.identity.getCurrentUserId();
    const current = await this.prisma.eventParticipant.findFirst({
      where: { id, event: { userId } },
    });
    if (!current) throw new NotFoundException(`EventParticipant ${id} was not found.`);
    if (input.evidenceFragmentId) await this.requireOwnedEvidenceFragment(input.evidenceFragmentId, userId);
    const validFrom = input.validFrom ? new Date(input.validFrom) : current.validFrom;
    const validTo = input.validTo ? new Date(input.validTo) : current.validTo;
    assertValidPeriod(validFrom?.toISOString(), validTo?.toISOString());

    return mapEventParticipant(await this.prisma.eventParticipant.update({
      where: { id },
      data: {
        role: input.role === undefined ? undefined : cleanOptionalText(input.role),
        description: input.description === undefined ? undefined : cleanOptionalText(input.description),
        evidenceFragmentId: input.evidenceFragmentId,
        validFrom: input.validFrom ? validFrom : undefined,
        validTo: input.validTo ? validTo : undefined,
      },
    }));
  }

  async deleteParticipant(id: string): Promise<void> {
    const userId = await this.identity.getCurrentUserId();
    const result = await this.prisma.eventParticipant.deleteMany({ where: { id, event: { userId } } });
    if (!result.count) throw new NotFoundException(`EventParticipant ${id} was not found.`);
  }

  private async requireOwnedEvent(id: string, userId: string) {
    const event = await this.prisma.event.findFirst({ where: { id, userId }, select: { id: true } });
    if (!event) throw new NotFoundException(`Event ${id} was not found.`);
  }

  private async requireOwnedEvidenceFragment(id: string, userId: string) {
    const fragment = await this.prisma.evidenceFragment.findFirst({
      where: { id, revision: { artifact: { userId } } },
      select: { id: true },
    });
    if (!fragment) throw new NotFoundException(`EvidenceFragment ${id} was not found.`);
  }
}

function cleanOptionalText(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value.trim() || null;
}

function assertValidPeriod(validFrom?: string, validTo?: string): void {
  if (validFrom && validTo && new Date(validFrom).getTime() >= new Date(validTo).getTime()) {
    throw new BadRequestException("validTo must be later than validFrom.");
  }
}
