import type { DecisionPath, LifeDecision } from "@digital-self/shared";
import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import {
  mapDecisionPath,
  mapLifeDecision,
  mapLifeDecisionDetail,
  type LifeDecisionDetailResponse,
} from "./life-decision.mapper";

type DecisionUpdateInput = {
  title?: string;
  description?: string | null;
  deadline?: string | null;
  status?: LifeDecision["status"];
  finalDecision?: string | null;
};

type DecisionPathCreateInput = {
  title: string;
  description?: string;
  benefits: string[];
  risks: string[];
  currentScore?: number;
};

type DecisionPathUpdateInput = {
  title?: string;
  description?: string | null;
  benefits?: string[];
  risks?: string[];
  currentScore?: number | null;
};

@Injectable()
export class LifeDecisionsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createDecision(
    userId: string,
    input: {
      title: string;
      description?: string;
      deadline?: string;
      status: LifeDecision["status"];
      finalDecision?: string;
    },
  ): Promise<LifeDecision> {
    const record = await this.prisma.lifeDecision.create({
      data: {
        userId,
        title: input.title,
        description: input.description,
        deadline: input.deadline ? new Date(input.deadline) : undefined,
        status: input.status,
        finalDecision: input.finalDecision,
      },
    });

    return mapLifeDecision(record);
  }

  async listDecisions(userId: string, status?: LifeDecision["status"]): Promise<LifeDecision[]> {
    const items = await this.prisma.lifeDecision.findMany({
      where: {
        userId,
        status,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    return items.map(mapLifeDecision);
  }

  async findDecisionById(userId: string, id: string): Promise<LifeDecisionDetailResponse | null> {
    const record = await this.prisma.lifeDecision.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        paths: {
          include: {
            evidenceItems: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            },
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
        evidenceItems: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
        externalSources: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    });

    return record ? mapLifeDecisionDetail(record) : null;
  }

  async findOwnedDecisionId(userId: string, id: string): Promise<string | null> {
    const record = await this.prisma.lifeDecision.findFirst({
      where: {
        id,
        userId,
      },
      select: {
        id: true,
      },
    });

    return record?.id ?? null;
  }

  async updateDecision(
    userId: string,
    id: string,
    input: DecisionUpdateInput,
  ): Promise<LifeDecision | null> {
    const existingId = await this.findOwnedDecisionId(userId, id);

    if (!existingId) {
      return null;
    }

    const record = await this.prisma.lifeDecision.update({
      where: { id: existingId },
      data: buildDecisionUpdateData(input),
    });

    return mapLifeDecision(record);
  }

  async createPath(decisionId: string, input: DecisionPathCreateInput): Promise<DecisionPath> {
    const record = await this.prisma.decisionPath.create({
      data: {
        decisionId,
        title: input.title,
        description: input.description,
        benefits: input.benefits,
        risks: input.risks,
        currentScore: input.currentScore,
      },
    });

    return mapDecisionPath(record);
  }

  async updatePath(
    userId: string,
    decisionId: string,
    pathId: string,
    input: DecisionPathUpdateInput,
  ): Promise<DecisionPath | null> {
    const existing = await this.prisma.decisionPath.findFirst({
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

    if (!existing) {
      return null;
    }

    const record = await this.prisma.decisionPath.update({
      where: { id: existing.id },
      data: buildDecisionPathUpdateData(input),
    });

    return mapDecisionPath(record);
  }
}

function buildDecisionUpdateData(input: DecisionUpdateInput) {
  return {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.deadline !== undefined
      ? { deadline: input.deadline ? new Date(input.deadline) : null }
      : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.finalDecision !== undefined ? { finalDecision: input.finalDecision } : {}),
  };
}

function buildDecisionPathUpdateData(input: DecisionPathUpdateInput) {
  return {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.benefits !== undefined ? { benefits: input.benefits } : {}),
    ...(input.risks !== undefined ? { risks: input.risks } : {}),
    ...(input.currentScore !== undefined ? { currentScore: input.currentScore } : {}),
  };
}
