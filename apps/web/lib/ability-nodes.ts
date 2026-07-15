import { apiRequest } from "@/lib/api-client";
import type { AbilityEvidence } from "@/lib/ability-evidence";

export type AbilityNodeOrigin = "system" | "custom";

export type AbilityNode = {
  id: string;
  userId: string;
  parentId?: string | null;
  name: string;
  description?: string | null;
  level: number;
  origin: AbilityNodeOrigin;
  createdAt: string;
  updatedAt: string;
};

export type AbilityNodeDetail = AbilityNode & {
  evidenceItems: AbilityEvidence[];
  children: AbilityNodeDetail[];
};

export type CreateAbilityNodeInput = {
  name: string;
  description?: string;
  parentId?: string | null;
};

export type UpdateAbilityNodeInput = {
  name?: string;
  description?: string | null;
  parentId?: string | null;
};

export type ListAbilityNodesResponse = {
  items: AbilityNodeDetail[];
};

export async function listAbilityNodes() {
  return apiRequest<ListAbilityNodesResponse>("/api/ability-nodes");
}

export async function getAbilityNode(id: string) {
  return apiRequest<AbilityNodeDetail>(`/api/ability-nodes/${id}`);
}

export async function createAbilityNode(input: CreateAbilityNodeInput) {
  return apiRequest<AbilityNodeDetail>("/api/ability-nodes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateAbilityNode(id: string, input: UpdateAbilityNodeInput) {
  return apiRequest<AbilityNodeDetail>(`/api/ability-nodes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteAbilityNode(id: string) {
  return apiRequest<null>(
    `/api/ability-nodes/${id}`,
    {
      method: "DELETE",
    },
    {
      allowEmpty: true,
      emptyData: null,
    },
  );
}
