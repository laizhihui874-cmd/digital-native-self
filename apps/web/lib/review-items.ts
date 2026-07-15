import type {
  ListReviewItemsResponse,
  ReviewItem,
  ReviewItemKind,
  BulkReviewItemsRequest,
  BulkReviewItemsResponse,
  ListReviewItemsQuery,
  ReviewReviewItemRequest,
} from "@digital-self/shared";

import { apiRequest } from "@/lib/api-client";

export function listReviewItems(input: ListReviewItemsQuery = {}) {
  const query = new URLSearchParams();
  if (input.kind) query.set("kind", input.kind);
  if (input.status) query.set("status", input.status);
  if (input.query) query.set("query", input.query);
  if (input.sourceType) query.set("sourceType", input.sourceType);
  if (input.dateFrom) query.set("dateFrom", input.dateFrom);
  if (input.dateTo) query.set("dateTo", input.dateTo);
  if (input.minConfidence !== undefined) query.set("minConfidence", String(input.minConfidence));
  if (input.sort) query.set("sort", input.sort);
  query.set("limit", String(input.limit ?? 30));
  query.set("offset", String(input.offset ?? 0));
  return apiRequest<ListReviewItemsResponse>(`/api/review-items?${query.toString()}`);
}

export function bulkReviewItems(input: BulkReviewItemsRequest) {
  return apiRequest<BulkReviewItemsResponse>("/api/review-items/bulk-review", { method: "POST", body: JSON.stringify(input) });
}

export function undoReviewItem(kind: ReviewItemKind, id: string) {
  return apiRequest<ReviewItem>(`/api/review-items/${kind}/${id}/undo`, { method: "POST", body: "{}" });
}

export function reviewItem(kind: ReviewItemKind, id: string, input: ReviewReviewItemRequest) {
  return apiRequest<ReviewItem>(`/api/review-items/${kind}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
