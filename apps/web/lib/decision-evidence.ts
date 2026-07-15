import { apiRequest } from "@/lib/api-client";
import type { DecisionEvidence, DecisionEvidenceType } from "@/lib/life-decisions";

export type CreateDecisionEvidenceInput = {
  decisionId: string;
  pathId: string;
  evidenceType: DecisionEvidenceType;
  content: string;
  externalSourceId?: string;
  weight?: number;
};

export async function createDecisionEvidence(input: CreateDecisionEvidenceInput) {
  return apiRequest<DecisionEvidence>("/api/decision-evidence", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
