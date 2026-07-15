import { apiRequest } from "@/lib/api-client";

export type ProjectPackagingSuggestionEvidenceItem = {
  evidenceType: "project" | "resume_material" | "ability_evidence";
  evidenceId: string;
  title?: string | null;
  content: string;
};

export type ProjectPackagingSuggestionItem = {
  id: string;
  category:
    | "project_title"
    | "resume_star"
    | "quantified_outcome"
    | "ability_mapping"
    | "gap_alert";
  label: string;
  suggestion: string;
  rationale: string;
  evidenceItems: ProjectPackagingSuggestionEvidenceItem[];
};

export type ProjectPackagingSuggestions = {
  targetRole: string;
  targetCompany?: string | null;
  targetJobDescription?: string | null;
  projectId?: string | null;
  analysisMode: "deterministic";
  summary: string;
  suggestionItems: ProjectPackagingSuggestionItem[];
  evidenceSnapshot: {
    selectedProject?: {
      id: string;
      name: string;
      role?: string | null;
      resumeSummary?: string | null;
      outcomes: string[];
    } | null;
    confirmedResumeMaterials: Array<{
      id: string;
      materialType: string;
      content: string;
      suggestedBullet?: string | null;
    }>;
    confirmedAbilityEvidence: Array<{
      id: string;
      abilityName: string;
      content: string;
    }>;
  };
  sourceSnapshot: {
    confirmedResumeMaterials: number;
    confirmedAbilityEvidence: number;
    availableProjects: number;
    scopedToProjectId?: string | null;
  };
};

export type CreateProjectPackagingSuggestionsInput = {
  targetRole: string;
  targetJobDescription?: string;
  targetCompany?: string;
  projectId?: string;
};

export async function createProjectPackagingSuggestions(
  input: CreateProjectPackagingSuggestionsInput,
) {
  return apiRequest<ProjectPackagingSuggestions>("/api/project-packaging-suggestions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
