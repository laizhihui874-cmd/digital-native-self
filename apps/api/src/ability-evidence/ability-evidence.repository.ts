import type {
  CreateAbilityEvidenceRequest,
  ListAbilityEvidenceQuery,
  ListAbilityEvidenceResponse,
  ReviewAbilityEvidenceRequest,
} from "@digital-self/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { mapAbilityEvidence } from "./ability-evidence.mapper";

@Injectable()
export class AbilityEvidenceRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    input: Required<
      Pick<
        CreateAbilityEvidenceRequest,
        | "abilityNodeId"
        | "content"
        | "impact"
        | "difficultyScore"
        | "independenceScore"
        | "impactScore"
        | "feedbackScore"
        | "recurrenceCount"
        | "status"
      >
    > &
      Pick<CreateAbilityEvidenceRequest, "sourceCitationId">,
  ) {
    const record = await this.prisma.abilityEvidence.create({
      data: {
        userId,
        abilityNodeId: input.abilityNodeId,
        sourceCitationId: input.sourceCitationId,
        content: input.content,
        impact: input.impact,
        difficultyScore: input.difficultyScore,
        independenceScore: input.independenceScore,
        impactScore: input.impactScore,
        feedbackScore: input.feedbackScore,
        recurrenceCount: input.recurrenceCount,
        status: input.status,
      },
    });

    return mapAbilityEvidence(record);
  }

  async findById(userId: string, id: string) {
    const record = await this.prisma.abilityEvidence.findFirst({
      where: {
        id,
        userId,
      },
    });

    return record ? mapAbilityEvidence(record) : null;
  }

  async list(params: {
    userId: string;
    abilityNodeId?: ListAbilityEvidenceQuery["abilityNodeId"];
    status?: ListAbilityEvidenceQuery["status"];
    limit: number;
    offset: number;
  }): Promise<ListAbilityEvidenceResponse> {
    const where = buildListWhereInput(params.userId, params.abilityNodeId, params.status);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.abilityEvidence.count({ where }),
      this.prisma.abilityEvidence.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: params.offset,
        take: params.limit,
      }),
    ]);

    return {
      items: items.map(mapAbilityEvidence),
      pagination: {
        limit: params.limit,
        offset: params.offset,
        total,
      },
    };
  }

  async review(userId: string, id: string, input: ReviewAbilityEvidenceRequest) {
    const existing = await this.prisma.abilityEvidence.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existing) {
      return null;
    }

    const record = await this.prisma.abilityEvidence.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        content: input.content ?? existing.content,
        impact: input.impact ?? existing.impact,
        difficultyScore: input.difficultyScore ?? existing.difficultyScore,
        independenceScore: input.independenceScore ?? existing.independenceScore,
        impactScore: input.impactScore ?? existing.impactScore,
        feedbackScore: input.feedbackScore ?? existing.feedbackScore,
        recurrenceCount: input.recurrenceCount ?? existing.recurrenceCount,
      },
    });

    return mapAbilityEvidence(record);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.abilityEvidence.deleteMany({
      where: {
        id,
        userId,
      },
    });

    return result.count > 0;
  }
}

function buildListWhereInput(
  userId: string,
  abilityNodeId?: ListAbilityEvidenceQuery["abilityNodeId"],
  status?: ListAbilityEvidenceQuery["status"],
): Prisma.AbilityEvidenceWhereInput {
  return {
    userId,
    abilityNodeId,
    status,
  };
}
