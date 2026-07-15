import type { StructuredTextItem, WeeklyReviewDetail } from "@digital-self/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { MetricType, Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { mapWeeklyReviewDetail } from "./weekly-reviews.mapper";

export type WeeklyReviewGenerationSource = {
  dailyEntries: Array<{
    id: string;
    recordedAt: string | null;
    structuredReport: {
      facts: StructuredTextItem[];
      emotions: StructuredTextItem[];
      workItems: StructuredTextItem[];
      growthEvidence: StructuredTextItem[];
      drainSources: StructuredTextItem[];
      nextActions: StructuredTextItem[];
      decisionImpact: StructuredTextItem[];
    } | null;
    metricRatings: Array<{
      metricType: MetricType;
      aiScore: number | null;
      userScore: number | null;
      finalScore: number | null;
    }>;
  }>;
  confirmedMemories: Array<{
    id: string;
    memoryType: string;
    content: string;
  }>;
  decisionEvidence: Array<{
    id: string;
    evidenceType: string;
    content: string;
    pathTitle: string;
  }>;
};

type UpsertWeeklyReviewInput = {
  lifeDecisionId?: string;
  periodStart: string;
  periodEnd: string;
  progressSummary: string;
  abilityChanges: StructuredTextItem[];
  emotionPatterns: StructuredTextItem[];
  goalDrift: string;
  nextWeekSuggestions: StructuredTextItem[];
  lifePossibilityNotes: string;
  emotionPattern: {
    dominantEmotions: string[];
    triggers: string[];
    patterns: StructuredTextItem[];
    decisionRisk: string;
  };
};

@Injectable()
export class WeeklyReviewsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findOwnedLifeDecisionId(userId: string, lifeDecisionId: string): Promise<string | null> {
    const record = await this.prisma.lifeDecision.findFirst({
      where: {
        id: lifeDecisionId,
        userId,
      },
      select: {
        id: true,
      },
    });

    return record?.id ?? null;
  }

  async collectGenerationSource(
    userId: string,
    periodStart: string,
    periodEnd: string,
    lifeDecisionId?: string,
  ): Promise<WeeklyReviewGenerationSource> {
    const periodRange = buildDateRange(periodStart, periodEnd);

    const [dailyEntries, confirmedMemories, decisionEvidence] = await this.prisma.$transaction([
      this.prisma.dailyEntry.findMany({
        where: {
          userId,
          OR: [
            {
              recordedAt: periodRange,
            },
            {
              recordedAt: null,
              createdAt: periodRange,
            },
          ],
        },
        include: {
          structuredReport: true,
          metricRatings: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
        orderBy: [{ recordedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      }),
      this.prisma.memory.findMany({
        where: {
          userId,
          status: "confirmed",
          createdAt: periodRange,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      this.prisma.decisionEvidence.findMany({
        where: {
          decision: {
            userId,
          },
          ...(lifeDecisionId ? { decisionId: lifeDecisionId } : {}),
          createdAt: periodRange,
        },
        include: {
          path: {
            select: {
              title: true,
            },
          },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    ]);

    return {
      dailyEntries: dailyEntries.map((entry) => ({
        id: entry.id,
        recordedAt: entry.recordedAt?.toISOString() ?? null,
        structuredReport: entry.structuredReport
          ? {
              facts: mapStructuredTextItems(entry.structuredReport.facts),
              emotions: mapStructuredTextItems(entry.structuredReport.emotions),
              workItems: mapStructuredTextItems(entry.structuredReport.workItems),
              growthEvidence: mapStructuredTextItems(entry.structuredReport.growthEvidence),
              drainSources: mapStructuredTextItems(entry.structuredReport.drainSources),
              nextActions: mapStructuredTextItems(entry.structuredReport.nextActions),
              decisionImpact: mapStructuredTextItems(entry.structuredReport.decisionImpact),
            }
          : null,
        metricRatings: entry.metricRatings.map((rating) => ({
          metricType: rating.metricType,
          aiScore: rating.aiScore,
          userScore: rating.userScore,
          finalScore: rating.finalScore,
        })),
      })),
      confirmedMemories: confirmedMemories.map((memory) => ({
        id: memory.id,
        memoryType: memory.memoryType,
        content: memory.content,
      })),
      decisionEvidence: decisionEvidence.map((evidence) => ({
        id: evidence.id,
        evidenceType: evidence.evidenceType,
        content: evidence.content,
        pathTitle: evidence.path.title,
      })),
    };
  }

  async upsertGeneratedReview(userId: string, input: UpsertWeeklyReviewInput): Promise<WeeklyReviewDetail> {
    return this.prisma.$transaction(async (transaction) => {
      const weeklyReview = await transaction.weeklyReview.upsert({
        where: {
          userId_periodStart_periodEnd: {
            userId,
            periodStart: new Date(input.periodStart),
            periodEnd: new Date(input.periodEnd),
          },
        },
        create: {
          userId,
          lifeDecisionId: input.lifeDecisionId ?? null,
          periodStart: new Date(input.periodStart),
          periodEnd: new Date(input.periodEnd),
          progressSummary: input.progressSummary,
          abilityChanges: input.abilityChanges,
          emotionPatterns: input.emotionPatterns,
          goalDrift: input.goalDrift,
          nextWeekSuggestions: input.nextWeekSuggestions,
          lifePossibilityNotes: input.lifePossibilityNotes,
        },
        update: {
          lifeDecisionId: input.lifeDecisionId ?? null,
          progressSummary: input.progressSummary,
          abilityChanges: input.abilityChanges,
          emotionPatterns: input.emotionPatterns,
          goalDrift: input.goalDrift,
          nextWeekSuggestions: input.nextWeekSuggestions,
          lifePossibilityNotes: input.lifePossibilityNotes,
        },
      });

      await transaction.emotionPattern.upsert({
        where: {
          userId_periodStart_periodEnd: {
            userId,
            periodStart: new Date(input.periodStart),
            periodEnd: new Date(input.periodEnd),
          },
        },
        create: {
          userId,
          weeklyReviewId: weeklyReview.id,
          periodStart: new Date(input.periodStart),
          periodEnd: new Date(input.periodEnd),
          dominantEmotions: input.emotionPattern.dominantEmotions,
          triggers: input.emotionPattern.triggers,
          patterns: input.emotionPattern.patterns,
          decisionRisk: input.emotionPattern.decisionRisk,
        },
        update: {
          weeklyReviewId: weeklyReview.id,
          dominantEmotions: input.emotionPattern.dominantEmotions,
          triggers: input.emotionPattern.triggers,
          patterns: input.emotionPattern.patterns,
          decisionRisk: input.emotionPattern.decisionRisk,
        },
      });

      const record = await transaction.weeklyReview.findUnique({
        where: {
          id: weeklyReview.id,
        },
        include: {
          emotionPattern: true,
        },
      });

      if (!record) {
        throw new Error(`WeeklyReview ${weeklyReview.id} was not found after upsert.`);
      }

      return mapWeeklyReviewDetail(record);
    });
  }

  async findLatest(userId: string, lifeDecisionId?: string): Promise<WeeklyReviewDetail | null> {
    const record = await this.prisma.weeklyReview.findFirst({
      where: {
        userId,
        ...(lifeDecisionId ? { lifeDecisionId } : {}),
      },
      include: {
        emotionPattern: true,
      },
      orderBy: [{ periodEnd: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
    });

    return record ? mapWeeklyReviewDetail(record) : null;
  }

  async findByPeriod(
    userId: string,
    periodStart: string,
    periodEnd: string,
    lifeDecisionId?: string,
  ): Promise<WeeklyReviewDetail | null> {
    const record = await this.prisma.weeklyReview.findFirst({
      where: {
        userId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        ...(lifeDecisionId ? { lifeDecisionId } : {}),
      },
      include: {
        emotionPattern: true,
      },
    });

    return record ? mapWeeklyReviewDetail(record) : null;
  }
}

function buildDateRange(periodStart: string, periodEnd: string): Prisma.DateTimeFilter {
  return {
    gte: new Date(periodStart),
    lte: new Date(periodEnd),
  };
}

function mapStructuredTextItems(value: unknown): StructuredTextItem[] {
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
