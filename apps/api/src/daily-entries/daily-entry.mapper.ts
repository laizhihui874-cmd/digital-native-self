import type {
  DailyEntry,
  DailyEntryDetail,
  Event,
  MetricRatingValue,
  StructuredDailyReport,
  StructuredTextItem,
} from "@digital-self/shared";
import type {
  DailyEntry as PrismaDailyEntry,
  Event as PrismaEvent,
  MetricRating as PrismaMetricRating,
  StructuredDailyReport as PrismaStructuredDailyReport,
} from "@prisma/client";

type DailyEntryWithRelations = PrismaDailyEntry & {
  structuredReport: PrismaStructuredDailyReport | null;
  metricRatings: PrismaMetricRating[];
  events: PrismaEvent[];
};

export function mapDailyEntry(record: PrismaDailyEntry): DailyEntry {
  return {
    id: record.id,
    userId: record.userId,
    source: record.source,
    rawContent: record.rawContent,
    recordedAt: toNullableIsoString(record.recordedAt),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function mapDailyEntryDetail(record: DailyEntryWithRelations): DailyEntryDetail {
  return {
    ...mapDailyEntry(record),
    structuredReport: record.structuredReport ? mapStructuredDailyReport(record.structuredReport) : null,
    metrics: record.metricRatings.map(mapMetricRating),
    events: record.events.map(mapEvent),
  };
}

function mapStructuredDailyReport(record: PrismaStructuredDailyReport): StructuredDailyReport {
  return {
    id: record.id,
    dailyEntryId: record.dailyEntryId,
    facts: mapStructuredTextItems(record.facts),
    emotions: mapStructuredTextItems(record.emotions),
    workItems: mapStructuredTextItems(record.workItems),
    feedback: mapStructuredTextItems(record.feedback),
    growthEvidence: mapStructuredTextItems(record.growthEvidence),
    drainSources: mapStructuredTextItems(record.drainSources),
    nextActions: mapStructuredTextItems(record.nextActions),
    decisionImpact: mapStructuredTextItems(record.decisionImpact),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function mapMetricRating(record: PrismaMetricRating): MetricRatingValue {
  return {
    metricType: record.metricType,
    aiScore: record.aiScore,
    userScore: record.userScore,
    finalScore: record.finalScore,
    aiReason: record.aiReason,
    confirmedByUser: record.confirmedByUser,
  };
}

function mapEvent(record: PrismaEvent): Event {
  return {
    id: record.id,
    userId: record.userId,
    dailyEntryId: record.dailyEntryId,
    title: record.title,
    description: record.description,
    eventType: record.eventType,
    occurredAt: record.occurredAt.toISOString(),
    endedAt: record.endedAt?.toISOString() ?? null,
    timePrecision: record.timePrecision,
    recordStatus: record.recordStatus,
    primarySourceCitationId: record.primarySourceCitationId,
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

function isStructuredTextItem(value: unknown): value is {
  title?: unknown;
  detail: string;
  citationIds?: unknown;
} {
  return typeof value === "object" && value !== null && typeof (value as { detail?: unknown }).detail === "string";
}

function toNullableIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}
