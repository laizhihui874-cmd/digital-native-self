import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

export type ResumeGapAnalysisSourceBundle = {
  resumeDocuments: Array<{
    id: string;
    title: string | null;
    content: string;
  }>;
  confirmedResumeMaterials: Array<{
    id: string;
    materialType: string;
    content: string;
    suggestedBullet: string | null;
  }>;
  projects: Array<{
    id: string;
    name: string;
    description: string | null;
    role: string | null;
    outcomes: string[];
    resumeSummary: string | null;
  }>;
  confirmedAbilityEvidence: Array<{
    id: string;
    content: string;
    abilityNode: {
      name: string;
    };
  }>;
  externalSources: Array<{
    id: string;
    title: string;
    sourceSite: string;
    summary: string | null;
    relationToDecision: string | null;
  }>;
};

@Injectable()
export class ResumeGapAnalysisRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listSources(userId: string): Promise<ResumeGapAnalysisSourceBundle> {
    const [
      resumeDocuments,
      confirmedResumeMaterials,
      projects,
      confirmedAbilityEvidence,
      externalSources,
    ] = await this.prisma.$transaction([
      this.prisma.resumeDocument.findMany({
        where: { userId },
        orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
        take: 20,
        select: {
          id: true,
          title: true,
          content: true,
        },
      }),
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
      this.prisma.externalSource.findMany({
        where: { userId },
        orderBy: [{ fetchedAt: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
        take: 50,
        select: {
          id: true,
          title: true,
          sourceSite: true,
          summary: true,
          relationToDecision: true,
        },
      }),
    ]);

    return {
      resumeDocuments,
      confirmedResumeMaterials,
      projects: projects.map((project) => ({
        ...project,
        outcomes: parseStringArray(project.outcomes),
      })),
      confirmedAbilityEvidence,
      externalSources,
    };
  }
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}
