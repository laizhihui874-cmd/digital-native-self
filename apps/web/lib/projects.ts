import { type AbilityEvidence } from "@/lib/ability-evidence";
import { apiRequest } from "@/lib/api-client";

export const projectStatusValues = [
  "planned",
  "active",
  "completed",
  "archived",
] as const;

export type ProjectStatus = (typeof projectStatusValues)[number];

export type Project = {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  role?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: ProjectStatus;
  outcomes: string[];
  resumeSummary?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectDetail = Project & {
  abilityEvidenceItems: AbilityEvidence[];
};

type PaginationMeta = {
  limit: number;
  offset: number;
  total: number;
};

export type ListProjectsResponse = {
  items: Project[];
  pagination: PaginationMeta;
};

export type CreateProjectInput = {
  name: string;
  description?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  status?: ProjectStatus;
  outcomes?: string[];
  resumeSummary?: string;
  abilityEvidenceIds?: string[];
};

export type UpdateProjectInput = Partial<CreateProjectInput>;

export async function createProject(input: CreateProjectInput) {
  return apiRequest<Project>("/api/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listProjects(params: {
  status?: ProjectStatus;
  limit?: number;
  offset?: number;
} = {}) {
  const searchParams = new URLSearchParams();

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

  return apiRequest<ListProjectsResponse>(`/api/projects${query ? `?${query}` : ""}`);
}

export async function getProject(id: string) {
  return apiRequest<ProjectDetail>(`/api/projects/${id}`);
}

export async function updateProject(id: string, input: UpdateProjectInput) {
  return apiRequest<Project>(`/api/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteProject(id: string) {
  return apiRequest<null>(
    `/api/projects/${id}`,
    {
      method: "DELETE",
    },
    {
      allowEmpty: true,
      emptyData: null,
    },
  );
}
