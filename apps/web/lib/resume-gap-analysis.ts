import { apiRequest } from "@/lib/api-client";

export type ResumeGapRequirementItem = {
  id: string;
  text: string;
  keywords: string[];
  source: "jd" | "role_template";
};

export type ResumeGapMatchedEvidence = {
  requirementId: string;
  requirementText: string;
  evidenceType:
    | "resume_document"
    | "resume_material"
    | "project"
    | "ability_evidence"
    | "external_source";
  evidenceId: string;
  title?: string | null;
  content: string;
  matchedKeywords: string[];
};

export type ResumeGapItem = {
  requirementId: string;
  requirementText: string;
  severity: "high" | "medium" | "low";
  reason: string;
  missingKeywords: string[];
};

export type ResumeGapAnalysis = {
  targetRole: string;
  targetCompany?: string | null;
  summary: string;
  analysisMode: "deterministic";
  requirementItems: ResumeGapRequirementItem[];
  matchedEvidence: ResumeGapMatchedEvidence[];
  gapItems: ResumeGapItem[];
  actionSuggestions: string[];
  sourceSnapshot: {
    resumeDocuments: number;
    confirmedResumeMaterials: number;
    projects: number;
    confirmedAbilityEvidence: number;
    externalSources: number;
  };
};

export type CreateResumeGapAnalysisInput = {
  targetRole: string;
  targetJobDescription?: string;
  targetCompany?: string;
};

export async function createResumeGapAnalysis(input: CreateResumeGapAnalysisInput) {
  return apiRequest<ResumeGapAnalysis>("/api/resume-gap-analysis", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
