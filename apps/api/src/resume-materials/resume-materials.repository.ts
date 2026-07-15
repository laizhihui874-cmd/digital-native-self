import type {
  CreateResumeMaterialRequest,
  ListResumeMaterialsQuery,
  ListResumeMaterialsResponse,
  ResumeMaterial,
  ResumeMaterialSourceType,
  StructuredTextItem,
  ReviewResumeMaterialRequest,
} from "@digital-self/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma, ResumeMaterialStatus } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { mapResumeMaterial } from "./resume-material.mapper";

type AbilityEvidenceExtractionSource = {
  id: string;
  content: string;
  impact: "positive" | "negative" | "neutral";
  impactScore: number;
  feedbackScore: number;
  abilityNode: {
    name: string;
  };
};

type ProjectExtractionSource = {
  id: string;
  resumeSummary: string | null;
  outcomes: string[];
};

type ResumeDocumentExtractionSource = {
  id: string;
  content: string;
};

type DailyEntryExtractionSource = {
  id: string;
  structuredReport: {
    growthEvidence: StructuredTextItem[];
    workItems: StructuredTextItem[];
  };
};

export type ExtractionSourceBundle = {
  abilityEvidence: AbilityEvidenceExtractionSource[];
  projects: ProjectExtractionSource[];
  resumeDocuments: ResumeDocumentExtractionSource[];
  dailyEntries: DailyEntryExtractionSource[];
};

type ExistingResumeMaterialKeyRecord = {
  sourceType: ResumeMaterialSourceType;
  sourceId: string | null;
  materialType: ResumeMaterial["materialType"];
  content: string;
};

@Injectable()
export class ResumeMaterialsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    input: Required<
      Pick<CreateResumeMaterialRequest, "sourceType" | "materialType" | "content" | "status">
    > &
      Pick<CreateResumeMaterialRequest, "sourceId" | "suggestedBullet" | "confidence">,
  ) {
    const record = await this.prisma.resumeMaterial.create({
      data: {
        userId,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        materialType: input.materialType,
        content: input.content,
        suggestedBullet: input.suggestedBullet ?? null,
        status: input.status,
        confidence: input.confidence ?? null,
      },
    });

    return mapResumeMaterial(record);
  }

  async findById(userId: string, id: string) {
    const record = await this.prisma.resumeMaterial.findFirst({
      where: {
        id,
        userId,
      },
    });

    return record ? mapResumeMaterial(record) : null;
  }

  async list(params: {
    userId: string;
    status?: ListResumeMaterialsQuery["status"];
    sourceType?: ListResumeMaterialsQuery["sourceType"];
    limit: number;
    offset: number;
  }): Promise<ListResumeMaterialsResponse> {
    const where = buildListWhereInput(params.userId, params.status, params.sourceType);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.resumeMaterial.count({ where }),
      this.prisma.resumeMaterial.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: params.offset,
        take: params.limit,
      }),
    ]);

    return {
      items: items.map(mapResumeMaterial),
      pagination: {
        limit: params.limit,
        offset: params.offset,
        total,
      },
    };
  }

  async review(userId: string, id: string, input: ReviewResumeMaterialRequest) {
    const existing = await this.prisma.resumeMaterial.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existing) {
      return null;
    }

    const record = await this.prisma.resumeMaterial.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.suggestedBullet !== undefined
          ? { suggestedBullet: input.suggestedBullet }
          : {}),
        ...(input.materialType !== undefined ? { materialType: input.materialType } : {}),
      },
    });

    return mapResumeMaterial(record);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.resumeMaterial.deleteMany({
      where: {
        id,
        userId,
      },
    });

    return result.count > 0;
  }

  async sourceExists(
    userId: string,
    sourceType: ResumeMaterialSourceType,
    sourceId: string | null | undefined,
  ): Promise<boolean> {
    if (sourceType === "manual") {
      return true;
    }

    if (!sourceId) {
      return false;
    }

    switch (sourceType) {
      case "ability_evidence":
        return Boolean(
          await this.prisma.abilityEvidence.findFirst({
            where: { id: sourceId, userId },
            select: { id: true },
          }),
        );
      case "project":
        return Boolean(
          await this.prisma.project.findFirst({
            where: { id: sourceId, userId },
            select: { id: true },
          }),
        );
      case "resume_document":
        return Boolean(
          await this.prisma.resumeDocument.findFirst({
            where: { id: sourceId, userId },
            select: { id: true },
          }),
        );
      case "daily_entry":
        return Boolean(
          await this.prisma.dailyEntry.findFirst({
            where: { id: sourceId, userId },
            select: { id: true },
          }),
        );
      default:
        return false;
    }
  }

  async listExtractionSources(userId: string): Promise<ExtractionSourceBundle> {
    const [abilityEvidence, projects, resumeDocuments, dailyEntries] = await this.prisma.$transaction([
      this.prisma.abilityEvidence.findMany({
        where: {
          userId,
          status: "confirmed",
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          content: true,
          impact: true,
          impactScore: true,
          feedbackScore: true,
          abilityNode: {
            select: {
              name: true,
            },
          },
        },
      }),
      this.prisma.project.findMany({
        where: {
          userId,
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          resumeSummary: true,
          outcomes: true,
        },
      }),
      this.prisma.resumeDocument.findMany({
        where: {
          userId,
        },
        orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          content: true,
        },
      }),
      this.prisma.dailyEntry.findMany({
        where: {
          userId,
          structuredReport: {
            isNot: null,
          },
        },
        orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          structuredReport: {
            select: {
              growthEvidence: true,
              workItems: true,
            },
          },
        },
      }),
    ]);

    return {
      abilityEvidence: abilityEvidence.map((item) => ({
        id: item.id,
        content: item.content,
        impact: item.impact,
        impactScore: item.impactScore,
        feedbackScore: item.feedbackScore,
        abilityNode: item.abilityNode,
      })),
      projects: projects.map((item) => ({
        id: item.id,
        resumeSummary: item.resumeSummary,
        outcomes: parseStringArray(item.outcomes),
      })),
      resumeDocuments,
      dailyEntries: dailyEntries.flatMap((item) => {
        if (!item.structuredReport) {
          return [];
        }

        return [
          {
            id: item.id,
            structuredReport: {
              growthEvidence: parseStructuredTextItems(item.structuredReport.growthEvidence),
              workItems: parseStructuredTextItems(item.structuredReport.workItems),
            },
          },
        ];
      }),
    };
  }

  async findExistingForSources(
    userId: string,
    refs: Array<{ sourceType: ResumeMaterialSourceType; sourceId: string }>,
  ): Promise<ExistingResumeMaterialKeyRecord[]> {
    if (refs.length === 0) {
      return [];
    }

    const uniqueRefs = refs.filter(
      (ref, index) =>
        index ===
        refs.findIndex(
          (candidate) =>
            candidate.sourceType === ref.sourceType && candidate.sourceId === ref.sourceId,
        ),
    );

    return this.prisma.resumeMaterial.findMany({
      where: {
        userId,
        OR: uniqueRefs.map((ref) => ({
          sourceType: ref.sourceType,
          sourceId: ref.sourceId,
        })),
      },
      select: {
        sourceType: true,
        sourceId: true,
        materialType: true,
        content: true,
      },
    });
  }
}

function buildListWhereInput(
  userId: string,
  status?: ResumeMaterialStatus,
  sourceType?: ListResumeMaterialsQuery["sourceType"],
): Prisma.ResumeMaterialWhereInput {
  return {
    userId,
    ...(status !== undefined ? { status } : {}),
    ...(sourceType !== undefined ? { sourceType } : {}),
  };
}

function parseStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function parseStructuredTextItems(value: unknown): StructuredTextItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isStructuredTextItem(item)) {
      return [];
    }

    return [
      {
        title: typeof item.title === "string" ? item.title : undefined,
        detail: item.detail,
        citationIds: Array.isArray(item.citationIds)
          ? item.citationIds.filter((citationId): citationId is string => typeof citationId === "string")
          : undefined,
      },
    ];
  });
}

function isStructuredTextItem(value: unknown): value is {
  title?: unknown;
  detail: string;
  citationIds?: unknown;
} {
  return typeof value === "object" && value !== null && typeof (value as { detail?: unknown }).detail === "string";
}
