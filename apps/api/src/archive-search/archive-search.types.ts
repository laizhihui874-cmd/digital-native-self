import type { CitationSourceType } from "@digital-self/shared";

export type SearchDocument = {
  sourceType: CitationSourceType;
  sourceId: string;
  sourceVersionId?: string;
  title: string;
  content: string;
  occurredAt?: string;
  status?: string;
  locator?: string;
  contextRefs: Array<{ entityType: string; entityId: string }>;
};
