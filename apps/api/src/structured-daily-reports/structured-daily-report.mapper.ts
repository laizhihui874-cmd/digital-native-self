import type { StructuredDailyReport, StructuredTextItem } from "@digital-self/shared";
import type { StructuredDailyReport as PrismaStructuredDailyReport } from "@prisma/client";

export function mapStructuredDailyReport(record: PrismaStructuredDailyReport): StructuredDailyReport {
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
