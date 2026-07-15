import { apiRequest } from "@/lib/api-client";

export type LifeDecisionStatus = "active" | "decided" | "archived";

export type DecisionEvidenceType = "support" | "against" | "neutral";

export type LifeDecision = {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  deadline?: string | null;
  status: LifeDecisionStatus;
  finalDecision?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DecisionPath = {
  id: string;
  decisionId: string;
  title: string;
  description?: string | null;
  benefits: string[];
  risks: string[];
  currentScore?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type DecisionEvidence = {
  id: string;
  decisionId: string;
  pathId: string;
  evidenceType: DecisionEvidenceType;
  content: string;
  sourceCitationId?: string | null;
  weight?: number | null;
  createdAt: string;
  updatedAt: string;
};

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

export type LifeDecisionDetail = LifeDecision & {
  paths: Array<DecisionPath & { evidenceItems: DecisionEvidence[] }>;
  evidenceItems: DecisionEvidence[];
  externalSources: ExternalSource[];
};

export async function listLifeDecisions(params?: { status?: LifeDecisionStatus }) {
  const searchParams = new URLSearchParams();

  if (params?.status) {
    searchParams.set("status", params.status);
  }

  const query = searchParams.toString();

  return apiRequest<LifeDecision[]>(`/api/life-decisions${query ? `?${query}` : ""}`);
}

export async function getLifeDecision(id: string) {
  return apiRequest<LifeDecisionDetail>(`/api/life-decisions/${id}`);
}
