import { apiRequest } from "@/lib/api-client";

export type StructuredTextItem = {
  title?: string;
  detail: string;
  citationIds?: string[];
};

export type WeeklyReviewSourceSnapshot = {
  dailyEntriesRead: number;
  structuredReportsRead: number;
  metricRatingsRead: number;
  confirmedMemoriesRead: number;
  decisionEvidenceRead: number;
};

export type WeeklyReviewDetail = {
  id: string;
  userId: string;
  lifeDecisionId?: string | null;
  periodStart: string;
  periodEnd: string;
  progressSummary?: string | null;
  abilityChanges: StructuredTextItem[];
  emotionPatterns: StructuredTextItem[];
  goalDrift?: string | null;
  nextWeekSuggestions: StructuredTextItem[];
  lifePossibilityNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  emotionPattern?: {
    id: string;
    userId: string;
    weeklyReviewId?: string | null;
    periodStart: string;
    periodEnd: string;
    dominantEmotions: string[];
    triggers: string[];
    patterns: StructuredTextItem[];
    decisionRisk?: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  citations?: Array<{
    id: string;
    title?: string | null;
    url?: string | null;
    sourceType?: string | null;
  }>;
};

export type WeeklyReviewGenerateRequest = {
  periodStart: string;
  periodEnd: string;
  lifeDecisionId?: string;
};

export type WeeklyReviewGenerateResponse = {
  weeklyReview: WeeklyReviewDetail;
  generationMode: "deterministic";
  sourceSnapshot: WeeklyReviewSourceSnapshot;
};

export type GetLatestWeeklyReviewQuery = {
  lifeDecisionId?: string;
};

export type GetWeeklyReviewByPeriodQuery = {
  periodStart: string;
  periodEnd: string;
  lifeDecisionId?: string;
};

function buildQueryString(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function getLatestWeeklyReview(query?: GetLatestWeeklyReviewQuery) {
  return apiRequest<WeeklyReviewDetail | null>(
    `/api/weekly-reviews/latest${buildQueryString({
      lifeDecisionId: query?.lifeDecisionId,
    })}`,
  );
}

export async function getWeeklyReviewByPeriod(query: GetWeeklyReviewByPeriodQuery) {
  return apiRequest<WeeklyReviewDetail | null>(
    `/api/weekly-reviews${buildQueryString({
      periodStart: query.periodStart,
      periodEnd: query.periodEnd,
      lifeDecisionId: query.lifeDecisionId,
    })}`,
  );
}

export async function generateWeeklyReview(input: WeeklyReviewGenerateRequest) {
  return apiRequest<WeeklyReviewGenerateResponse>("/api/weekly-reviews/generate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
