import { apiRequest } from "@/lib/api-client";

export type ExternalSource = {
  id: string;
  userId: string;
  lifeDecisionId?: string | null;
  title: string;
  sourceSite: string;
  url: string;
  publishedAt?: string | null;
  fetchedAt?: string | null;
  summary?: string | null;
  relationToDecision?: string | null;
  createdAt: string;
  updatedAt: string;
};

type PaginationMeta = {
  limit: number;
  offset: number;
  total: number;
};

export type ListExternalSourcesResponse = {
  items: ExternalSource[];
  pagination: PaginationMeta;
};

export const externalSourceSearchCategoryValues = [
  "ai_role",
  "job_market",
  "industry",
  "postgraduate",
  "other",
] as const;

export type ExternalSourceSearchCategory = (typeof externalSourceSearchCategoryValues)[number];

export type SearchExternalSourceItem = {
  title: string;
  sourceSite: string;
  url: string;
  publishedAt?: string | null;
  summary?: string | null;
  relationToDecision?: string | null;
};

export type SearchExternalSourcesInput = {
  query: string;
  category?: ExternalSourceSearchCategory;
  lifeDecisionId?: string;
  limit?: number;
};

export type SearchExternalSourcesResponse = {
  query: string;
  category: ExternalSourceSearchCategory;
  searchMode: "fake" | "best_effort_web";
  summary: string;
  items: SearchExternalSourceItem[];
  savedItems: ExternalSource[];
  sourceSnapshot: {
    searchedAt: string;
    provider: string;
    requestedLimit: number;
    returnedResults: number;
    savedResults: number;
    lifeDecisionId?: string | null;
  };
};

export type CreateExternalSourceImpactDraftInput = {
  lifeDecisionId: string;
  externalSourceIds?: string[];
  maxItems?: number;
};

export type ExternalSourceImpactDraftItem = {
  externalSourceId: string;
  externalSourceTitle: string;
  sourceSite: string;
  url: string;
  pathId: string;
  pathTitle: string;
  evidenceType: "support" | "against" | "neutral";
  suggestedWeight: number;
  suggestedContent: string;
  rationale: string;
  confirmationRequired: true;
};

export type ExternalSourceImpactDraftResponse = {
  analysisMode: "deterministic";
  lifeDecisionId: string;
  generatedAt: string;
  items: ExternalSourceImpactDraftItem[];
  warnings: string[];
  sourceSnapshot: {
    externalSourcesRead: number;
    pathsRead: number;
    selectedSourceIds: string[];
  };
};

export type CreateExternalSourceInput = {
  lifeDecisionId?: string;
  title: string;
  sourceSite: string;
  url: string;
  publishedAt?: string;
  summary?: string;
  relationToDecision?: string;
};

export type UpdateExternalSourceInput = {
  lifeDecisionId?: string | null;
  title?: string;
  sourceSite?: string;
  url?: string;
  publishedAt?: string | null;
  summary?: string | null;
  relationToDecision?: string | null;
};

export async function createExternalSource(input: CreateExternalSourceInput) {
  return apiRequest<ExternalSource>("/api/external-sources", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function searchExternalSources(input: SearchExternalSourcesInput) {
  return apiRequest<SearchExternalSourcesResponse>("/api/external-sources/search", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createExternalSourceImpactDraft(
  input: CreateExternalSourceImpactDraftInput,
) {
  return apiRequest<ExternalSourceImpactDraftResponse>("/api/external-sources/impact-draft", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listExternalSources(params?: {
  lifeDecisionId?: string;
  limit?: number;
  offset?: number;
}) {
  const searchParams = new URLSearchParams();

  if (params?.lifeDecisionId) {
    searchParams.set("lifeDecisionId", params.lifeDecisionId);
  }

  if (typeof params?.limit === "number") {
    searchParams.set("limit", String(params.limit));
  }

  if (typeof params?.offset === "number") {
    searchParams.set("offset", String(params.offset));
  }

  const query = searchParams.toString();

  return apiRequest<ListExternalSourcesResponse>(
    `/api/external-sources${query ? `?${query}` : ""}`,
  );
}

export async function getExternalSource(id: string) {
  return apiRequest<ExternalSource>(`/api/external-sources/${id}`);
}

export async function updateExternalSource(id: string, input: UpdateExternalSourceInput) {
  return apiRequest<ExternalSource>(`/api/external-sources/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteExternalSource(id: string) {
  return apiRequest<null>(
    `/api/external-sources/${id}`,
    {
      method: "DELETE",
    },
    {
      allowEmpty: true,
      emptyData: null,
    },
  );
}
