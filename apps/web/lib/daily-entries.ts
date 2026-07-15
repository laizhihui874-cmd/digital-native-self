import { apiRequest } from "@/lib/api-client";
import type { Memory } from "@/lib/memories";

export type DailyEntry = {
  id: string;
  userId: string;
  source: "feishu" | "web" | "import";
  rawContent: string;
  recordedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type PaginationMeta = {
  limit: number;
  offset: number;
  total: number;
};

type StructuredTextItem = {
  title?: string;
  detail: string;
  citationIds?: string[];
};

type StructuredDailyReport = {
  id: string;
  dailyEntryId: string;
  facts: StructuredTextItem[];
  emotions: StructuredTextItem[];
  workItems: StructuredTextItem[];
  feedback: StructuredTextItem[];
  growthEvidence: StructuredTextItem[];
  drainSources: StructuredTextItem[];
  nextActions: StructuredTextItem[];
  decisionImpact: StructuredTextItem[];
  createdAt: string;
  updatedAt: string;
};

export type MetricType =
  | "growth"
  | "emotional_drain"
  | "long_term_fit"
  | "communication_pressure";

export type MetricRatingValue = {
  metricType: MetricType;
  aiScore?: number | null;
  userScore?: number | null;
  finalScore?: number | null;
  aiReason?: string | null;
  confirmedByUser: boolean;
};

export type UpsertMetricRatingInput = {
  metricType: MetricType;
  aiScore?: number;
  userScore?: number;
  finalScore?: number;
  aiReason?: string;
  confirmedByUser?: boolean;
};

type Event = {
  id: string;
  title: string;
  eventType: string;
  occurredAt: string;
};

export type DailyEntryDetail = DailyEntry & {
  structuredReport?: StructuredDailyReport | null;
  metrics: MetricRatingValue[];
  events: Event[];
};

export type ListDailyEntriesResponse = {
  items: DailyEntry[];
  pagination: PaginationMeta;
};

export type CreateStructuredDailyReportMemoryCandidatesResponse = {
  source: {
    dailyEntryId: string;
    structuredReportId: string;
  };
  created: Memory[];
  skippedCount: number;
};

export async function createDailyEntry(input: {
  rawContent: string;
  recordedAt?: string;
}) {
  return apiRequest<DailyEntryDetail>("/api/daily-entries", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listDailyEntries(params?: { limit?: number; offset?: number }) {
  const searchParams = new URLSearchParams();

  if (typeof params?.limit === "number") {
    searchParams.set("limit", String(params.limit));
  }

  if (typeof params?.offset === "number") {
    searchParams.set("offset", String(params.offset));
  }

  const query = searchParams.toString();

  return apiRequest<ListDailyEntriesResponse>(
    `/api/daily-entries${query ? `?${query}` : ""}`,
  );
}

export async function getDailyEntry(id: string) {
  return apiRequest<DailyEntryDetail>(`/api/daily-entries/${id}`);
}

export async function listMetricRatingsForDailyEntry(dailyEntryId: string) {
  return apiRequest<MetricRatingValue[]>(`/api/daily-entries/${dailyEntryId}/metric-ratings`);
}

export async function upsertMetricRatingForDailyEntry(
  dailyEntryId: string,
  input: UpsertMetricRatingInput,
) {
  return apiRequest<MetricRatingValue>(`/api/daily-entries/${dailyEntryId}/metric-ratings`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createStructuredReportDraftForDailyEntry(dailyEntryId: string) {
  return apiRequest<DailyEntryDetail["structuredReport"]>(
    `/api/daily-entries/${dailyEntryId}/structured-report-draft`,
    {
      method: "POST",
    },
  );
}

export async function createStructuredReportGenerateForDailyEntry(dailyEntryId: string) {
  return apiRequest<DailyEntryDetail["structuredReport"]>(
    `/api/daily-entries/${dailyEntryId}/structured-report-generate`,
    {
      method: "POST",
    },
  );
}

export async function createMemoryCandidatesForStructuredDailyReport(dailyEntryId: string) {
  return apiRequest<CreateStructuredDailyReportMemoryCandidatesResponse>(
    `/api/structured-daily-reports/${dailyEntryId}/memory-candidates`,
    {
      method: "POST",
    },
  );
}
