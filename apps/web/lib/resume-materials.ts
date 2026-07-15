import { apiRequest } from "@/lib/api-client";

export const resumeMaterialSourceTypeValues = [
  "ability_evidence",
  "project",
  "resume_document",
  "daily_entry",
  "manual",
] as const;

export const resumeMaterialTypeValues = [
  "achievement",
  "responsibility",
  "skill",
  "project_summary",
  "reflection",
  "other",
] as const;

export const resumeMaterialStatusValues = ["candidate", "confirmed", "rejected"] as const;

export type ResumeMaterialSourceType = (typeof resumeMaterialSourceTypeValues)[number];
export type ResumeMaterialType = (typeof resumeMaterialTypeValues)[number];
export type ResumeMaterialStatus = (typeof resumeMaterialStatusValues)[number];

export type ResumeMaterial = {
  id: string;
  userId: string;
  sourceType: ResumeMaterialSourceType;
  sourceId?: string | null;
  materialType: ResumeMaterialType;
  content: string;
  suggestedBullet?: string | null;
  status: ResumeMaterialStatus;
  confidence?: number | null;
  createdAt: string;
  updatedAt: string;
};

type PaginationMeta = {
  limit: number;
  offset: number;
  total: number;
};

export type ExtractResumeMaterialCandidatesInput = {
  limitPerSource?: number;
};

export type ExtractResumeMaterialCandidatesResponse = {
  created: ResumeMaterial[];
  skippedCount: number;
  scanned: {
    abilityEvidence: number;
    projects: number;
    resumeDocuments: number;
    dailyEntries: number;
  };
};

export type ListResumeMaterialsParams = {
  status?: ResumeMaterialStatus;
  sourceType?: ResumeMaterialSourceType;
  limit?: number;
  offset?: number;
};

export type ListResumeMaterialsResponse = {
  items: ResumeMaterial[];
  pagination: PaginationMeta;
};

export type ReviewResumeMaterialInput = {
  status: Extract<ResumeMaterialStatus, "confirmed" | "rejected">;
  content?: string;
  suggestedBullet?: string | null;
  materialType?: ResumeMaterialType;
};

export async function extractResumeMaterialCandidates(
  input: ExtractResumeMaterialCandidatesInput = {},
) {
  return apiRequest<ExtractResumeMaterialCandidatesResponse>(
    "/api/resume-materials/extract-candidates",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function listResumeMaterials(params: ListResumeMaterialsParams = {}) {
  const searchParams = new URLSearchParams();

  if (params.status) {
    searchParams.set("status", params.status);
  }

  if (params.sourceType) {
    searchParams.set("sourceType", params.sourceType);
  }

  if (typeof params.limit === "number") {
    searchParams.set("limit", String(params.limit));
  }

  if (typeof params.offset === "number") {
    searchParams.set("offset", String(params.offset));
  }

  const query = searchParams.toString();

  return apiRequest<ListResumeMaterialsResponse>(
    `/api/resume-materials${query ? `?${query}` : ""}`,
  );
}

export async function getResumeMaterial(id: string) {
  return apiRequest<ResumeMaterial>(`/api/resume-materials/${id}`);
}

export async function reviewResumeMaterial(id: string, input: ReviewResumeMaterialInput) {
  return apiRequest<ResumeMaterial>(`/api/resume-materials/${id}/review`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteResumeMaterial(id: string) {
  return apiRequest<null>(
    `/api/resume-materials/${id}`,
    {
      method: "DELETE",
    },
    {
      allowEmpty: true,
      emptyData: null,
    },
  );
}
