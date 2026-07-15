import type {
  CreateProjectRequest,
  ListProjectsQuery,
  ListProjectsResponse,
  ProjectDetail,
  UpdateProjectRequest,
} from "@digital-self/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { mapProject, mapProjectDetail } from "./project.mapper";

@Injectable()
export class ProjectsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateProjectRequest) {
    const record = await this.prisma.$transaction(async (transaction) => {
      const project = await transaction.project.create({
        data: {
          userId,
          name: input.name,
          description: input.description,
          role: input.role,
          startDate: input.startDate ? new Date(input.startDate) : null,
          endDate: input.endDate ? new Date(input.endDate) : null,
          status: input.status ?? "active",
          outcomes: input.outcomes ?? [],
          resumeSummary: input.resumeSummary,
        },
      });

      if (input.abilityEvidenceIds?.length) {
        await transaction.projectAbilityEvidence.createMany({
          data: input.abilityEvidenceIds.map((abilityEvidenceId) => ({
            projectId: project.id,
            abilityEvidenceId,
          })),
        });
      }

      return project;
    });

    return mapProject(record);
  }

  async list(params: {
    userId: string;
    status?: ListProjectsQuery["status"];
    limit: number;
    offset: number;
  }): Promise<ListProjectsResponse> {
    const where = buildListWhereInput(params.userId, params.status);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: params.offset,
        take: params.limit,
      }),
    ]);

    return {
      items: items.map(mapProject),
      pagination: {
        limit: params.limit,
        offset: params.offset,
        total,
      },
    };
  }

  async findById(userId: string, id: string): Promise<ProjectDetail | null> {
    const record = await this.prisma.project.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        abilityEvidence: {
          include: {
            abilityEvidence: true,
          },
          orderBy: [{ linkedAt: "asc" }, { abilityEvidenceId: "asc" }],
        },
      },
    });

    return record ? mapProjectDetail(record) : null;
  }

  async update(userId: string, id: string, input: UpdateProjectRequest) {
    const existing = await this.prisma.project.findFirst({
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

    const record = await this.prisma.$transaction(async (transaction) => {
      const project = await transaction.project.update({
        where: {
          id: existing.id,
        },
        data: buildUpdateData(input),
      });

      if (input.abilityEvidenceIds !== undefined) {
        await transaction.projectAbilityEvidence.deleteMany({
          where: {
            projectId: existing.id,
          },
        });

        if (input.abilityEvidenceIds.length > 0) {
          await transaction.projectAbilityEvidence.createMany({
            data: input.abilityEvidenceIds.map((abilityEvidenceId) => ({
              projectId: existing.id,
              abilityEvidenceId,
            })),
          });
        }
      }

      return project;
    });

    return mapProject(record);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.project.deleteMany({
      where: {
        id,
        userId,
      },
    });

    return result.count > 0;
  }

  async findOwnedAbilityEvidenceIds(userId: string, ids: string[]): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }

    const records = await this.prisma.abilityEvidence.findMany({
      where: {
        id: {
          in: ids,
        },
        userId,
      },
      select: {
        id: true,
      },
    });

    return records.map((record) => record.id);
  }
}

function buildListWhereInput(
  userId: string,
  status?: ListProjectsQuery["status"],
): Prisma.ProjectWhereInput {
  return {
    userId,
    ...(status !== undefined ? { status } : {}),
  };
}

function buildUpdateData(input: UpdateProjectRequest): Prisma.ProjectUpdateInput {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.role !== undefined ? { role: input.role } : {}),
    ...(input.startDate !== undefined
      ? { startDate: input.startDate ? new Date(input.startDate) : null }
      : {}),
    ...(input.endDate !== undefined
      ? { endDate: input.endDate ? new Date(input.endDate) : null }
      : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.outcomes !== undefined ? { outcomes: input.outcomes } : {}),
    ...(input.resumeSummary !== undefined ? { resumeSummary: input.resumeSummary } : {}),
  };
}
