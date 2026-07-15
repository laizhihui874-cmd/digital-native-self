import { apiRequest } from "@/lib/api-client";

export const abilityEvidenceImpactValues = [
  "positive",
  "neutral",
  "negative",
] as const;

export const abilityEvidenceStatusValues = [
  "candidate",
  "confirmed",
  "rejected",
] as const;

export const abilityEvidenceScoreRange = { min: 1, max: 5 } as const;
export const abilityFeedbackScoreRange = { min: -2, max: 2 } as const;

export type AbilityEvidenceImpact = (typeof abilityEvidenceImpactValues)[number];
export type AbilityEvidenceStatus = (typeof abilityEvidenceStatusValues)[number];

export type AbilityEvidence = {
  id: string;
  userId: string;
  abilityNodeId: string;
  sourceCitationId?: string | null;
  content: string;
  impact: AbilityEvidenceImpact;
  difficultyScore: number;
  independenceScore: number;
  impactScore: number;
  feedbackScore: number;
  recurrenceCount: number;
  status: AbilityEvidenceStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateAbilityEvidenceInput = {
  abilityNodeId: string;
  sourceCitationId?: string;
  content: string;
  impact: AbilityEvidenceImpact;
  difficultyScore: number;
  independenceScore: number;
  impactScore: number;
  feedbackScore: number;
  recurrenceCount?: number;
  status?: Extract<AbilityEvidenceStatus, "candidate">;
};

export type ListAbilityEvidenceParams = {
  abilityNodeId?: string;
  status?: AbilityEvidenceStatus;
  limit?: number;
  offset?: number;
};

export type ListAbilityEvidenceResponse = {
  items: AbilityEvidence[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
};

export type ReviewAbilityEvidenceInput = {
  status: Extract<AbilityEvidenceStatus, "confirmed" | "rejected">;
  content?: string;
  impact?: AbilityEvidenceImpact;
  difficultyScore?: number;
  independenceScore?: number;
  impactScore?: number;
  feedbackScore?: number;
  recurrenceCount?: number;
};

export async function createAbilityEvidence(input: CreateAbilityEvidenceInput) {
  return apiRequest<AbilityEvidence>("/api/ability-evidence", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listAbilityEvidence(params: ListAbilityEvidenceParams = {}) {
  const searchParams = new URLSearchParams();

  if (params.abilityNodeId) {
    searchParams.set("abilityNodeId", params.abilityNodeId);
  }

  if (params.status) {
    searchParams.set("status", params.status);
  }

  if (typeof params.limit === "number") {
    searchParams.set("limit", String(params.limit));
  }

  if (typeof params.offset === "number") {
    searchParams.set("offset", String(params.offset));
  }

  const query = searchParams.toString();

  return apiRequest<ListAbilityEvidenceResponse>(
    `/api/ability-evidence${query ? `?${query}` : ""}`,
  );
}

export async function reviewAbilityEvidence(id: string, input: ReviewAbilityEvidenceInput) {
  return apiRequest<AbilityEvidence>(`/api/ability-evidence/${id}/review`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteAbilityEvidence(id: string) {
  return apiRequest<null>(
    `/api/ability-evidence/${id}`,
    {
      method: "DELETE",
    },
    {
      allowEmpty: true,
      emptyData: null,
    },
  );
}
