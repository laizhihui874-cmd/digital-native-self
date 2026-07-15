import { apiRequest } from "@/lib/api-client";

export type MemoryType =
  | "goal"
  | "ability"
  | "value"
  | "event"
  | "relationship"
  | "recurring_problem"
  | "decision";

export type MemoryStatus = "candidate" | "confirmed" | "rejected" | "expired";

export type Memory = {
  id: string;
  userId: string;
  memoryType: MemoryType;
  content: string;
  sourceCitationId?: string | null;
  status: MemoryStatus;
  confidence?: number | null;
  isMomentaryThought: boolean;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type PaginationMeta = {
  limit: number;
  offset: number;
  total: number;
};

export type ListMemoriesResponse = {
  items: Memory[];
  pagination: PaginationMeta;
};

export type ReviewMemoryInput = {
  content?: string;
  memoryType?: MemoryType;
  status: Extract<MemoryStatus, "confirmed" | "rejected" | "expired">;
  expiresAt?: string | null;
  isMomentaryThought?: boolean;
  changeReason?: string;
};

export async function listMemories(params?: {
  status?: MemoryStatus;
  limit?: number;
  offset?: number;
}) {
  const searchParams = new URLSearchParams();

  if (params?.status) {
    searchParams.set("status", params.status);
  }

  if (typeof params?.limit === "number") {
    searchParams.set("limit", String(params.limit));
  }

  if (typeof params?.offset === "number") {
    searchParams.set("offset", String(params.offset));
  }

  const query = searchParams.toString();

  return apiRequest<ListMemoriesResponse>(`/api/memories${query ? `?${query}` : ""}`);
}

export async function reviewMemory(id: string, input: ReviewMemoryInput) {
  return apiRequest<Memory>(`/api/memories/${id}/review`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteMemory(id: string) {
  return apiRequest<null>(
    `/api/memories/${id}`,
    {
      method: "DELETE",
    },
    {
      allowEmpty: true,
      emptyData: null,
    },
  );
}
