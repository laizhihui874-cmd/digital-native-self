import type {
  CreateExternalSourceRequest,
  ListExternalSourcesQuery,
  ListExternalSourcesResponse,
  UpdateExternalSourceRequest,
} from "@digital-self/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { mapExternalSource } from "./external-source.mapper";

@Injectable()
export class ExternalSourcesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateExternalSourceRequest) {
    const record = await this.prisma.externalSource.create({
      data: {
        userId,
        lifeDecisionId: input.lifeDecisionId,
        title: input.title,
        sourceSite: input.sourceSite,
        url: input.url,
        publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
        fetchedAt: new Date(),
        summary: input.summary,
        relationToDecision: input.relationToDecision,
      },
    });

    return mapExternalSource(record);
  }

  async findById(userId: string, id: string) {
    const record = await this.prisma.externalSource.findFirst({
      where: {
        id,
        userId,
      },
    });

    return record ? mapExternalSource(record) : null;
  }

  async list(params: {
    userId: string;
    lifeDecisionId?: ListExternalSourcesQuery["lifeDecisionId"];
    limit: number;
    offset: number;
  }): Promise<ListExternalSourcesResponse> {
    const where = buildListWhereInput(params.userId, params.lifeDecisionId);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.externalSource.count({ where }),
      this.prisma.externalSource.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: params.offset,
        take: params.limit,
      }),
    ]);

    return {
      items: items.map(mapExternalSource),
      pagination: {
        limit: params.limit,
        offset: params.offset,
        total,
      },
    };
  }

  async update(userId: string, id: string, input: UpdateExternalSourceRequest) {
    const existing = await this.prisma.externalSource.findFirst({
      where: {
        id,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return null;
    }

    const record = await this.prisma.externalSource.update({
      where: { id: existing.id },
      data: buildUpdateData(input),
    });

    return mapExternalSource(record);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.externalSource.deleteMany({
      where: {
        id,
        userId,
      },
    });

    return result.count > 0;
  }

  async findOwnedLifeDecisionId(userId: string, id: string): Promise<string | null> {
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
}

function buildListWhereInput(
  userId: string,
  lifeDecisionId?: ListExternalSourcesQuery["lifeDecisionId"],
): Prisma.ExternalSourceWhereInput {
  return {
    userId,
    ...(lifeDecisionId !== undefined ? { lifeDecisionId } : {}),
  };
}

function buildUpdateData(input: UpdateExternalSourceRequest): Prisma.ExternalSourceUpdateInput {
  return {
    ...(input.lifeDecisionId !== undefined ? { lifeDecisionId: input.lifeDecisionId } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.sourceSite !== undefined ? { sourceSite: input.sourceSite } : {}),
    ...(input.url !== undefined ? { url: input.url } : {}),
    ...(input.publishedAt !== undefined
      ? { publishedAt: input.publishedAt ? new Date(input.publishedAt) : null }
      : {}),
    ...(input.summary !== undefined ? { summary: input.summary } : {}),
    ...(input.relationToDecision !== undefined
      ? { relationToDecision: input.relationToDecision }
      : {}),
  };
}
