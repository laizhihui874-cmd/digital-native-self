import type {
  BulkReviewItemsRequest,
  BulkReviewItemsResponse,
  ListReviewItemsQuery,
  ListReviewItemsResponse,
  ReviewItem,
  ReviewItemKind,
  ReviewReviewItemRequest,
} from "@digital-self/shared";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";

import { AbilityEvidenceService } from "../ability-evidence/ability-evidence.service";
import { EventsService } from "../events/events.service";
import { DefaultIdentityService } from "../identity/default-identity.service";
import { MemoriesService } from "../memories/memories.service";
import { PrismaService } from "../prisma/prisma.service";

const proposalInclude = {
  evidenceFragment: { include: { revision: { include: { artifact: true } } } },
} satisfies Prisma.ProposalInclude;

const memoryInclude = {
  sourceCitation: true,
  evidenceSources: { take: 1, include: { evidenceFragment: { include: { revision: { include: { artifact: true } } } } } },
} satisfies Prisma.MemoryInclude;

const abilityInclude = { abilityNode: true, sourceCitation: true } satisfies Prisma.AbilityEvidenceInclude;

type ProposalRecord = Prisma.ProposalGetPayload<{ include: typeof proposalInclude }>;
type MemoryRecord = Prisma.MemoryGetPayload<{ include: typeof memoryInclude }>;
type AbilityRecord = Prisma.AbilityEvidenceGetPayload<{ include: typeof abilityInclude }>;

@Injectable()
export class ReviewItemsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DefaultIdentityService) private readonly identity: DefaultIdentityService,
    @Inject(EventsService) private readonly events: EventsService,
    @Inject(MemoriesService) private readonly memories: MemoriesService,
    @Inject(AbilityEvidenceService) private readonly abilityEvidence: AbilityEvidenceService,
  ) {}

  async list(query: ListReviewItemsQuery): Promise<ListReviewItemsResponse> {
    const userId = await this.identity.getCurrentUserId();
    const status = query.status ?? "candidate";
    const kinds = query.kind ? [query.kind] : ["proposal", "memory", "ability_evidence"] satisfies ReviewItemKind[];
    const [proposals, memories, abilityItems, proposalCount, memoryCount, abilityCount] = await Promise.all([
      kinds.includes("proposal")
        ? this.prisma.proposal.findMany({ where: { userId, status }, include: proposalInclude })
        : Promise.resolve([] as ProposalRecord[]),
      kinds.includes("memory")
        ? this.prisma.memory.findMany({ where: { userId, status }, include: memoryInclude })
        : Promise.resolve([] as MemoryRecord[]),
      kinds.includes("ability_evidence")
        ? this.prisma.abilityEvidence.findMany({ where: { userId, status }, include: abilityInclude })
        : Promise.resolve([] as AbilityRecord[]),
      this.prisma.proposal.count({ where: { userId, status: "candidate" } }),
      this.prisma.memory.count({ where: { userId, status: "candidate" } }),
      this.prisma.abilityEvidence.count({ where: { userId, status: "candidate" } }),
    ]);

    const all = [
      ...proposals.map(mapProposal),
      ...memories.map(mapMemory),
      ...abilityItems.map(mapAbilityEvidence),
    ];
    const normalizedQuery = normalizeText(query.query ?? "");
    const dateFrom = query.dateFrom ? new Date(query.dateFrom).getTime() : null;
    const dateTo = query.dateTo ? new Date(query.dateTo).getTime() : null;
    const filtered = all.filter((item) => {
      const createdAt = new Date(item.createdAt).getTime();
      if (normalizedQuery && !normalizeText(`${item.title}\n${item.content}\n${item.source?.title ?? ""}`).includes(normalizedQuery)) return false;
      if (query.sourceType && item.source?.type !== query.sourceType) return false;
      if (dateFrom !== null && createdAt < dateFrom) return false;
      if (dateTo !== null && createdAt > dateTo) return false;
      if (query.minConfidence !== undefined && (item.confidence == null || item.confidence < query.minConfidence)) return false;
      return true;
    });

    const duplicateCounts = new Map<string, number>();
    for (const item of filtered) {
      const key = duplicateKey(item);
      duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1);
    }
    const withDuplicates = filtered.map((item) => {
      const key = duplicateKey(item);
      const duplicateCount = duplicateCounts.get(key) ?? 1;
      return duplicateCount > 1 ? { ...item, duplicateGroupId: `dup_${key}`, duplicateCount } : item;
    });
    withDuplicates.sort(reviewItemSorter(query.sort ?? "newest"));

    const limit = query.limit ?? 30;
    const offset = query.offset ?? 0;
    const globalPendingCount = proposalCount + memoryCount + abilityCount;
    return {
      items: withDuplicates.slice(offset, offset + limit),
      pagination: { total: withDuplicates.length, limit, offset },
      counts: { proposal: proposalCount, memory: memoryCount, ability_evidence: abilityCount },
      globalPendingCount,
      filteredCount: withDuplicates.length,
    };
  }

  async review(kind: ReviewItemKind, id: string, input: ReviewReviewItemRequest): Promise<ReviewItem> {
    assertKind(kind);
    const before = await this.findOwnedItem(kind, id);
    if (before.status !== "candidate") throw new ConflictException(`Review item ${kind}/${id} has already been reviewed.`);
    if (input.status === "confirmed") {
      const title = (input.title ?? before.title).trim();
      const content = (input.content ?? before.content).trim();
      if (!title || !content) throw new BadRequestException("标题和正文都不能为空，当前内容不能确认。");
    }

    if (kind === "proposal") {
      await this.events.reviewCandidate(id, { status: input.status, title: input.title, description: input.content });
    } else if (kind === "memory") {
      await this.memories.review(id, { status: input.status, content: input.content, changeReason: input.note ?? "用户从统一待确认页完成审核。" });
    } else {
      await this.abilityEvidence.review(id, { status: input.status, content: input.content });
    }

    const reviewed = await this.findOwnedItem(kind, id);
    if (kind !== "proposal") {
      const userId = await this.identity.getCurrentUserId();
      await this.prisma.reviewItemHistory.create({ data: {
        userId,
        kind,
        itemId: id,
        fromStatus: "candidate",
        toStatus: input.status,
        snapshot: reviewSnapshot(before, reviewed),
        note: input.note ?? "用户从统一待确认页完成审核。",
      } });
    }
    return reviewed;
  }

  async bulkReview(input: BulkReviewItemsRequest): Promise<BulkReviewItemsResponse> {
    const results: BulkReviewItemsResponse["results"] = [];
    for (const target of input.items) {
      try {
        const item = await this.review(target.kind, target.id, {
          status: input.status,
          title: target.title,
          content: target.content,
          note: input.note ?? "用户从统一待确认页批量审核。",
        });
        results.push({ kind: target.kind, id: target.id, ok: true, item });
      } catch (error) {
        results.push({ kind: target.kind, id: target.id, ok: false, error: safeReviewError(error) });
      }
    }
    const succeeded = results.filter((item) => item.ok).length;
    return { results, summary: { requested: results.length, succeeded, failed: results.length - succeeded } };
  }

  async undo(kind: ReviewItemKind, id: string): Promise<ReviewItem> {
    assertKind(kind);
    const userId = await this.identity.getCurrentUserId();
    const current = await this.findOwnedItem(kind, id);
    if (current.status === "candidate") throw new ConflictException("这条内容已经是待确认状态，不需要撤销。");

    if (kind === "proposal") {
      await this.undoProposal(userId, id);
      return this.findOwnedItem(kind, id);
    }
    if (kind === "memory") {
      await this.prisma.$transaction(async (tx) => {
        const record = await tx.memory.findFirst({ where: { id, userId } });
        if (!record) throw new NotFoundException(`Review item memory/${id} was not found.`);
        if (record.status !== "confirmed" && record.status !== "rejected") throw new ConflictException("只有已确认或已拒绝的记忆可以撤销。");
        await tx.memory.update({ where: { id }, data: { status: "candidate" } });
        await tx.reviewItemHistory.create({ data: { userId, kind, itemId: id, fromStatus: record.status, toStatus: "candidate", snapshot: { content: record.content, memoryType: record.memoryType }, note: "用户撤销统一待确认审核" } });
      });
    } else {
      await this.prisma.$transaction(async (tx) => {
        const record = await tx.abilityEvidence.findFirst({ where: { id, userId } });
        if (!record) throw new NotFoundException(`Review item ability_evidence/${id} was not found.`);
        if (record.status !== "confirmed" && record.status !== "rejected") throw new ConflictException("只有已确认或已拒绝的能力证据可以撤销。");
        await tx.abilityEvidence.update({ where: { id }, data: { status: "candidate" } });
        await tx.reviewItemHistory.create({ data: { userId, kind, itemId: id, fromStatus: record.status, toStatus: "candidate", snapshot: { content: record.content, abilityNodeId: record.abilityNodeId }, note: "用户撤销统一待确认审核" } });
      });
    }
    return this.findOwnedItem(kind, id);
  }

  private async undoProposal(userId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const proposal = await tx.proposal.findFirst({ where: { id, userId } });
      if (!proposal) throw new NotFoundException(`Review item proposal/${id} was not found.`);
      if (proposal.status === "rejected") {
        await tx.proposal.update({ where: { id }, data: { status: "candidate", reviewedAt: null } });
        await tx.proposalReview.create({ data: { proposalId: id, fromStatus: "rejected", toStatus: "candidate", snapshot: proposal.payload as Prisma.InputJsonValue, note: "用户撤销拒绝" } });
        return;
      }
      if (proposal.status !== "confirmed" || proposal.appliedEntityType !== "event" || !proposal.appliedEntityId) {
        throw new ConflictException("这条建议没有可撤销的已确认事件。");
      }
      const eventId = proposal.appliedEntityId;
      const [participants, graphRelations, citations, otherApplications, legacyCandidates] = await Promise.all([
        tx.eventParticipant.count({ where: { eventId } }),
        tx.graphRelation.count({ where: { userId, OR: [{ sourceType: "event", sourceId: eventId }, { targetType: "event", targetId: eventId }] } }),
        tx.sourceCitation.count({ where: { userId, sourceType: "event", sourceId: eventId } }),
        tx.proposal.count({ where: { userId, id: { not: id }, appliedEntityType: "event", appliedEntityId: eventId } }),
        tx.eventCandidate.count({ where: { userId, confirmedEventId: eventId } }),
      ]);
      const downstreamCount = participants + graphRelations + citations + otherApplications + legacyCandidates;
      if (downstreamCount > 0) {
        throw new ConflictException(`这个事件已有 ${downstreamCount} 条下游引用，不能撤销。请先处理参与人物、图关系、引用或其他关联。`);
      }
      await tx.event.delete({ where: { id: eventId } });
      await tx.proposal.update({ where: { id }, data: { status: "candidate", reviewedAt: null, appliedEntityType: null, appliedEntityId: null } });
      await tx.proposalReview.create({ data: { proposalId: id, fromStatus: "confirmed", toStatus: "candidate", snapshot: proposal.payload as Prisma.InputJsonValue, note: "用户撤销确认并移除没有下游引用的事件" } });
    });
  }

  private async findOwnedItem(kind: ReviewItemKind, id: string): Promise<ReviewItem> {
    const userId = await this.identity.getCurrentUserId();
    if (kind === "proposal") {
      const item = await this.prisma.proposal.findFirst({ where: { id, userId }, include: proposalInclude });
      if (item) return mapProposal(item);
    } else if (kind === "memory") {
      const item = await this.prisma.memory.findFirst({ where: { id, userId }, include: memoryInclude });
      if (item) return mapMemory(item);
    } else if (kind === "ability_evidence") {
      const item = await this.prisma.abilityEvidence.findFirst({ where: { id, userId }, include: abilityInclude });
      if (item) return mapAbilityEvidence(item);
    }
    throw new NotFoundException(`Review item ${kind}/${id} was not found.`);
  }
}

function mapProposal(item: ProposalRecord): ReviewItem {
  const payload = asRecord(item.payload);
  const source = item.evidenceFragment
    ? {
        type: item.evidenceFragment.revision.artifact.artifactType,
        title: item.evidenceFragment.revision.artifact.title ?? "原始档案片段",
        excerpt: item.evidenceFragment.content,
        path: `/archive?artifactId=${item.evidenceFragment.revision.artifact.id}`,
      }
    : null;
  return {
    kind: "proposal",
    id: item.id,
    proposalType: item.proposalType,
    title: item.title,
    content: item.summary ?? stringValue(payload.description) ?? "",
    status: item.status,
    confidence: item.confidence,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    source,
    metadata: {
      origin: item.origin,
      eventType: stringValue(payload.eventType),
      occurredAt: stringValue(payload.occurredAt),
      timePrecision: stringValue(payload.timePrecision),
    },
  };
}

function mapMemory(item: MemoryRecord): ReviewItem {
  const evidence = item.evidenceSources[0]?.evidenceFragment;
  const source = evidence
    ? {
        type: evidence.revision.artifact.artifactType,
        title: evidence.revision.artifact.title ?? "原始档案片段",
        excerpt: evidence.content,
        path: `/archive?artifactId=${evidence.revision.artifact.id}`,
      }
    : item.sourceCitation
      ? { type: item.sourceCitation.sourceType, title: item.sourceCitation.title ?? "来源记录", excerpt: item.sourceCitation.excerpt, path: citationPath(item.sourceCitation.metadata) }
      : null;
  return {
    kind: "memory",
    id: item.id,
    title: `候选记忆 · ${memoryTypeLabel(item.memoryType)}`,
    content: item.content,
    status: item.status,
    confidence: item.confidence,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    source,
    metadata: { memoryType: item.memoryType, isMomentaryThought: item.isMomentaryThought, expiresAt: item.expiresAt?.toISOString() ?? null },
  };
}

function mapAbilityEvidence(item: AbilityRecord): ReviewItem {
  return {
    kind: "ability_evidence",
    id: item.id,
    title: `能力证据 · ${item.abilityNode.name}`,
    content: item.content,
    status: item.status,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    source: item.sourceCitation
      ? { type: item.sourceCitation.sourceType, title: item.sourceCitation.title ?? "来源记录", excerpt: item.sourceCitation.excerpt, path: citationPath(item.sourceCitation.metadata) }
      : null,
    metadata: {
      impact: item.impact,
      difficultyScore: item.difficultyScore,
      independenceScore: item.independenceScore,
      impactScore: item.impactScore,
      feedbackScore: item.feedbackScore,
      recurrenceCount: item.recurrenceCount,
    },
  };
}

function asRecord(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, Prisma.JsonValue> : {};
}

function stringValue(value: Prisma.JsonValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function citationPath(metadata: Prisma.JsonValue): string {
  const value = asRecord(metadata);
  return typeof value.sourcePath === "string" ? value.sourcePath : "/archive";
}

function memoryTypeLabel(value: string): string {
  return ({ goal: "目标", ability: "能力", value: "价值观", event: "事件", relationship: "关系", recurring_problem: "重复问题", decision: "决策" } as Record<string, string>)[value] ?? value;
}

function assertKind(kind: ReviewItemKind): void {
  if (!( ["proposal", "memory", "ability_evidence"] as string[]).includes(kind)) throw new BadRequestException(`Unsupported review item kind '${kind}'.`);
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("zh-CN").replace(/\s+/g, " ").trim();
}

function duplicateKey(item: ReviewItem): string {
  return createHash("sha256").update(`${normalizeText(item.title)}\n${normalizeText(item.content)}`).digest("hex").slice(0, 20);
}

function reviewItemSorter(sort: NonNullable<ListReviewItemsQuery["sort"]>): (left: ReviewItem, right: ReviewItem) => number {
  if (sort === "oldest") return (left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
  if (sort === "confidence_desc") return (left, right) => (right.confidence ?? -1) - (left.confidence ?? -1) || right.createdAt.localeCompare(left.createdAt);
  if (sort === "confidence_asc") return (left, right) => (left.confidence ?? Number.POSITIVE_INFINITY) - (right.confidence ?? Number.POSITIVE_INFINITY) || right.createdAt.localeCompare(left.createdAt);
  return (left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id);
}

function reviewSnapshot(before: ReviewItem, after: ReviewItem): Prisma.InputJsonValue {
  return { titleBefore: before.title, contentBefore: before.content, titleAfter: after.title, contentAfter: after.content };
}

function safeReviewError(error: unknown): string {
  const value = error instanceof Error ? error.message : "审核失败。";
  return value.replace(/(?:sk-|Bearer\s+)[A-Za-z0-9._-]+/gi, "[已隐藏]").slice(0, 500);
}
