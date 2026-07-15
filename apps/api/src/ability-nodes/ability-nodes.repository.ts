import type { CreateAbilityNodeRequest } from "@digital-self/shared";
import { Inject, Injectable } from "@nestjs/common";
import type {
  AbilityEvidence as PrismaAbilityEvidence,
  AbilityNode as PrismaAbilityNode,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

type AbilityNodeFlatRecord = {
  id: string;
  userId: string;
  parentId: string | null;
  name: string;
  description: string | null;
  level: number;
  origin: "system" | "custom";
  createdAt: Date;
  updatedAt: Date;
};

export type { AbilityNodeFlatRecord };

@Injectable()
export class AbilityNodesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listTreeRecords(userId: string): Promise<PrismaAbilityNode[]> {
    return this.prisma.abilityNode.findMany({
      where: { userId },
      orderBy: [{ level: "asc" }, { createdAt: "asc" }, { name: "asc" }],
    });
  }

  async listEvidenceRecords(
    userId: string,
    abilityNodeIds: string[],
  ): Promise<PrismaAbilityEvidence[]> {
    if (abilityNodeIds.length === 0) {
      return [];
    }

    return this.prisma.abilityEvidence.findMany({
      where: {
        userId,
        abilityNodeId: {
          in: abilityNodeIds,
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  async listFlatRecords(userId: string): Promise<AbilityNodeFlatRecord[]> {
    return this.prisma.abilityNode.findMany({
      where: { userId },
      select: {
        id: true,
        userId: true,
        parentId: true,
        name: true,
        description: true,
        level: true,
        origin: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ level: "asc" }, { createdAt: "asc" }, { name: "asc" }],
    });
  }

  async findFlatRecordById(userId: string, id: string): Promise<AbilityNodeFlatRecord | null> {
    return this.prisma.abilityNode.findFirst({
      where: {
        id,
        userId,
      },
      select: {
        id: true,
        userId: true,
        parentId: true,
        name: true,
        description: true,
        level: true,
        origin: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findSiblingByName(
    userId: string,
    parentId: string | null,
    name: string,
    excludeId?: string,
  ): Promise<{ id: string } | null> {
    return this.prisma.abilityNode.findFirst({
      where: {
        userId,
        parentId,
        name,
        id: excludeId
          ? {
              not: excludeId,
            }
          : undefined,
      },
      select: {
        id: true,
      },
    });
  }

  async create(
    userId: string,
    input: Required<Pick<CreateAbilityNodeRequest, "name">> &
      Pick<CreateAbilityNodeRequest, "description" | "parentId"> & {
        level: number;
        origin: "custom";
      },
  ): Promise<{ id: string }> {
    return this.prisma.abilityNode.create({
      data: {
        userId,
        parentId: input.parentId ?? null,
        name: input.name,
        description: input.description ?? null,
        level: input.level,
        origin: input.origin,
      },
      select: {
        id: true,
      },
    });
  }

  async updateNodeAndDescendantLevels(params: {
    id: string;
    name: string;
    description: string | null;
    parentId: string | null;
    level: number;
    descendants: Array<{
      id: string;
      level: number;
    }>;
  }): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.abilityNode.update({
        where: { id: params.id },
        data: {
          name: params.name,
          description: params.description,
          parentId: params.parentId,
          level: params.level,
        },
      });

      for (const descendant of params.descendants) {
        await transaction.abilityNode.update({
          where: { id: descendant.id },
          data: {
            level: descendant.level,
          },
        });
      }
    });
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.abilityNode.deleteMany({
      where: {
        id,
        userId,
      },
    });

    return result.count > 0;
  }
}
