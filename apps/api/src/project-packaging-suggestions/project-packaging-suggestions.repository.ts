import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

export type ProjectPackagingSuggestionSourceBundle = {
  confirmedResumeMaterials: Array<{
    id: string;
    materialType: string;
    content: string;
    suggestedBullet: string | null;
  }>;
  confirmedAbilityEvidence: Array<{
    id: string;
    content: string;
    abilityNode: {
      name: string;
    };
  }>;
  availableProjects: Array<{
    id: string;
    name: string;
    description: string | null;
    role: string | null;
    outcomes: string[];
    resumeSummary: string | null;
  }>;
};

@Injectable()
export class ProjectPackagingSuggestionsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listSources(userId: string): Promise<ProjectPackagingSuggestionSourceBundle> {
    const [confirmedResumeMaterials, confirmedAbilityEvidence, availableProjects] =
      await this.prisma.$transaction([
        this.prisma.resumeMaterial.findMany({
          where: {
            userId,
            status: "confirmed",
          },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: 80,
          select: {
            id: true,
            materialType: true,
            content: true,
            suggestedBullet: true,
          },
        }),
        this.prisma.abilityEvidence.findMany({
          where: {
            userId,
            status: "confirmed",
          },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: 100,
          select: {
            id: true,
            content: true,
            abilityNode: {
              select: {
                name: true,
              },
            },
          },
        }),
        this.prisma.project.findMany({
          where: { userId },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: 50,
          select: {
            id: true,
            name: true,
            description: true,
            role: true,
            outcomes: true,
            resumeSummary: true,
          },
        }),
      ]);

    return {
      confirmedResumeMaterials,
      confirmedAbilityEvidence,
      availableProjects: availableProjects.map((project) => ({
        ...project,
        outcomes: parseStringArray(project.outcomes),
      })),
    };
  }
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}
