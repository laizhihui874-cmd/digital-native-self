import type {
  CitationSourceType,
  CreateDecisionEvidenceRequest,
  DecisionEvidence,
  ListDecisionEvidenceQuery,
  ListDecisionEvidenceResponse,
  UpdateDecisionEvidenceRequest,
} from "@digital-self/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { mapDecisionEvidence } from "./decision-evidence.mapper";

@Injectable()
export class DecisionEvidenceRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(
    input: Required<
      Pick<CreateDecisionEvidenceRequest, "decisionId" | "pathId" | "evidenceType" | "content">
    > &
      Pick<CreateDecisionEvidenceRequest, "sourceCitationId" | "weight">,
  ): Promise<DecisionEvidence> {
    const record = await this.prisma.decisionEvidence.create({
      data: {
        decisionId: input.decisionId,
        pathId: input.pathId,
        evidenceType: input.evidenceType,
        content: input.content,
        sourceCitationId: input.sourceCitationId,
        weight: input.weight,
      },
    });

    return mapDecisionEvidence(record);
  }

  async list(userId: string, query: ListDecisionEvidenceQuery): Promise<DecisionEvidence[]> {
    const records = await this.prisma.decisionEvidence.findMany({
      where: buildListWhereInput(userId, query),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    return records.map(mapDecisionEvidence);
  }

  async listPaginated(
    userId: string,
    query: ListDecisionEvidenceQuery,
    pagination: {
      limit: number;
      offset: number;
    },
  ): Promise<ListDecisionEvidenceResponse> {
    const where = buildListWhereInput(userId, query);
    const [total, records] = await this.prisma.$transaction([
      this.prisma.decisionEvidence.count({ where }),
      this.prisma.decisionEvidence.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: pagination.limit,
        skip: pagination.offset,
      }),
    ]);

    return {
      items: records.map(mapDecisionEvidence),
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset,
        total,
      },
    };
  }

  async findById(userId: string, id: string): Promise<DecisionEvidence | null> {
    const record = await this.prisma.decisionEvidence.findFirst({
      where: {
        id,
        decision: {
          userId,
        },
      },
    });

    return record ? mapDecisionEvidence(record) : null;
  }

  async update(
    userId: string,
    id: string,
    input: UpdateDecisionEvidenceRequest,
  ): Promise<DecisionEvidence | null> {
    const existing = await this.prisma.decisionEvidence.findFirst({
      where: {
        id,
        decision: {
          userId,
        },
      },
    });

    if (!existing) {
      return null;
    }

    const record = await this.prisma.decisionEvidence.update({
      where: { id: existing.id },
      data: {
        evidenceType: input.evidenceType ?? existing.evidenceType,
        content: input.content ?? existing.content,
        weight: input.weight === undefined ? existing.weight : input.weight,
      },
    });

    return mapDecisionEvidence(record);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.decisionEvidence.deleteMany({
      where: {
        id,
        decision: {
          userId,
        },
      },
    });

    return result.count > 0;
  }

  async findOwnedDecisionId(userId: string, decisionId: string): Promise<string | null> {
    const record = await this.prisma.lifeDecision.findFirst({
      where: {
        id: decisionId,
        userId,
      },
      select: {
        id: true,
      },
    });

    return record?.id ?? null;
  }

  async findOwnedPathId(userId: string, decisionId: string, pathId: string): Promise<string | null> {
    const record = await this.prisma.decisionPath.findFirst({
      where: {
        id: pathId,
        decisionId,
        decision: {
          userId,
        },
      },
      select: {
        id: true,
      },
    });

    return record?.id ?? null;
  }

  async findOwnedPathIdByUser(userId: string, pathId: string): Promise<string | null> {
    const record = await this.prisma.decisionPath.findFirst({
      where: {
        id: pathId,
        decision: {
          userId,
        },
      },
      select: {
        id: true,
      },
    });

    return record?.id ?? null;
  }

  async findSourceCitationBySource(sourceType: CitationSourceType, sourceId: string) {
    return this.prisma.sourceCitation.findFirst({
      where: {
        sourceType,
        sourceId,
      },
      select: {
        id: true,
      },
    });
  }

  async findOwnedSourceCitationById(userId: string, id: string) {
    const citation = await this.prisma.sourceCitation.findFirst({
      where: { id },
      select: {
        id: true,
        sourceType: true,
        sourceId: true,
      },
    });

    if (!citation) {
      return null;
    }

    const isOwned = await this.isCitationOwnedByUser(userId, citation.sourceType, citation.sourceId);
    return isOwned ? citation : null;
  }

  async createSourceCitation(input: {
    sourceType: CitationSourceType;
    sourceId: string;
    title?: string | null;
    url?: string | null;
    excerpt?: string | null;
    locator?: string | null;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.sourceCitation.create({
      data: {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        title: input.title,
        url: input.url,
        excerpt: input.excerpt,
        locator: input.locator,
        metadata: input.metadata,
      },
      select: {
        id: true,
      },
    });
  }

  async findOwnedExternalSourceById(userId: string, id: string) {
    return this.prisma.externalSource.findFirst({
      where: {
        id,
        userId,
      },
      select: {
        id: true,
        userId: true,
        lifeDecisionId: true,
        title: true,
        sourceSite: true,
        url: true,
        publishedAt: true,
        fetchedAt: true,
        summary: true,
        relationToDecision: true,
      },
    });
  }

  private async isCitationOwnedByUser(
    userId: string,
    sourceType: CitationSourceType,
    sourceId: string,
  ): Promise<boolean> {
    switch (sourceType) {
      case "daily_entry":
        return Boolean(
          await this.prisma.dailyEntry.findFirst({
            where: {
              id: sourceId,
              userId,
            },
            select: { id: true },
          }),
        );
      case "external_link":
        return Boolean(
          await this.prisma.externalSource.findFirst({
            where: {
              id: sourceId,
              userId,
            },
            select: { id: true },
          }),
        );
      case "imported_file":
        return Boolean(
          await this.prisma.importedFile.findFirst({
            where: {
              id: sourceId,
              userId,
            },
            select: { id: true },
          }),
        );
      case "memory":
        return Boolean(
          await this.prisma.memory.findFirst({
            where: {
              id: sourceId,
              userId,
            },
            select: { id: true },
          }),
        );
      case "event":
        return Boolean(
          await this.prisma.event.findFirst({
            where: {
              id: sourceId,
              userId,
            },
            select: { id: true },
          }),
        );
      case "project":
        return Boolean(
          await this.prisma.project.findFirst({
            where: {
              id: sourceId,
              userId,
            },
            select: { id: true },
          }),
        );
      case "ability_evidence":
        return Boolean(await this.prisma.abilityEvidence.findFirst({ where: { id: sourceId, userId }, select: { id: true } }));
      case "life_decision":
        return Boolean(await this.prisma.lifeDecision.findFirst({ where: { id: sourceId, userId }, select: { id: true } }));
      case "person":
        return Boolean(await this.prisma.person.findFirst({ where: { id: sourceId, userId }, select: { id: true } }));
      case "goal":
        return Boolean(await this.prisma.goal.findFirst({ where: { id: sourceId, userId }, select: { id: true } }));
      case "plan":
        return Boolean(await this.prisma.futurePlan.findFirst({ where: { id: sourceId, userId }, select: { id: true } }));
      case "milestone":
        return Boolean(await this.prisma.milestone.findFirst({ where: { id: sourceId, userId }, select: { id: true } }));
      case "action":
        return Boolean(await this.prisma.actionItem.findFirst({ where: { id: sourceId, userId }, select: { id: true } }));
      case "weekly_review":
        return Boolean(await this.prisma.weeklyReview.findFirst({ where: { id: sourceId, userId }, select: { id: true } }));
      case "evidence_fragment":
        return Boolean(await this.prisma.evidenceFragment.findFirst({ where: { id: sourceId, revision: { artifact: { userId } } }, select: { id: true } }));
      case "feishu_message":
        return false;
      default: {
        const exhaustiveCheck: never = sourceType;
        return exhaustiveCheck;
      }
    }
  }
}

function buildListWhereInput(
  userId: string,
  query: ListDecisionEvidenceQuery,
): Prisma.DecisionEvidenceWhereInput {
  return {
    decision: {
      userId,
    },
    ...(query.decisionId !== undefined ? { decisionId: query.decisionId } : {}),
    ...(query.pathId !== undefined ? { pathId: query.pathId } : {}),
  };
}
