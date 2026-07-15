import type { EmotionPattern, StructuredTextItem, WeeklyReviewDetail } from "@digital-self/shared";
import type {
  EmotionPattern as PrismaEmotionPattern,
  WeeklyReview as PrismaWeeklyReview,
} from "@prisma/client";

type WeeklyReviewWithEmotionPattern = PrismaWeeklyReview & {
  emotionPattern: PrismaEmotionPattern | null;
};

export function mapWeeklyReviewDetail(record: WeeklyReviewWithEmotionPattern): WeeklyReviewDetail {
  return {
    id: record.id,
    userId: record.userId,
    lifeDecisionId: record.lifeDecisionId,
    periodStart: record.periodStart.toISOString(),
    periodEnd: record.periodEnd.toISOString(),
    progressSummary: record.progressSummary,
    abilityChanges: mapStructuredTextItems(record.abilityChanges),
    emotionPatterns: mapStructuredTextItems(record.emotionPatterns),
    goalDrift: record.goalDrift,
    nextWeekSuggestions: mapStructuredTextItems(record.nextWeekSuggestions),
    lifePossibilityNotes: record.lifePossibilityNotes,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    emotionPattern: record.emotionPattern ? mapEmotionPattern(record.emotionPattern) : null,
  };
}

function mapEmotionPattern(record: PrismaEmotionPattern): EmotionPattern {
  return {
    id: record.id,
    userId: record.userId,
    weeklyReviewId: record.weeklyReviewId,
    periodStart: record.periodStart.toISOString(),
    periodEnd: record.periodEnd.toISOString(),
    dominantEmotions: mapStringArray(record.dominantEmotions),
    triggers: mapStringArray(record.triggers),
    patterns: mapStructuredTextItems(record.patterns),
    decisionRisk: record.decisionRisk,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
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

function mapStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function isStructuredTextItem(value: unknown): value is {
  title?: unknown;
  detail: string;
  citationIds?: unknown;
} {
  return typeof value === "object" && value !== null && typeof (value as { detail?: unknown }).detail === "string";
}
