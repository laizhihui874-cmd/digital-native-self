import {
  type DigitalSelfApiClientOptions,
  type DigitalSelfApiResponse,
  createDigitalSelfApiClient,
  DigitalSelfApiClientError,
} from "./api";
import {
  createDigitalSelfMcpServer,
  createMcpToolErrorResult,
} from "./server";
import type {
  DigitalSelfMcpServer,
  DigitalSelfMcpServerOptions,
  McpToolExecutionResult,
  McpToolHandler,
  McpToolHandlerMap,
} from "./types";

type StructuredTextItem = {
  title?: string;
  detail: string;
};

type StructuredDailyReport = {
  id: string;
  dailyEntryId: string;
  facts: StructuredTextItem[];
  emotions: StructuredTextItem[];
  workItems: StructuredTextItem[];
  feedback: StructuredTextItem[];
  growthEvidence: StructuredTextItem[];
  drainSources: StructuredTextItem[];
  nextActions: StructuredTextItem[];
  decisionImpact: StructuredTextItem[];
  createdAt: string;
  updatedAt: string;
};

type Memory = {
  id: string;
  memoryType: string;
  content: string;
  sourceCitationId?: string | null;
  status: string;
  confidence?: number | null;
  createdAt: string;
};

type ListMemoriesResponse = {
  items: Memory[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
};

type DailyEntryListItem = {
  id: string;
  source: string;
  rawContent: string;
  createdAt: string;
};

type DailyEntryDetailResponse = DailyEntryListItem & {
  structuredReport?: StructuredDailyReport | null;
};

type ListDailyEntriesResponse = {
  items: DailyEntryListItem[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
};

type AbilityEvidence = {
  id: string;
  status: string;
};

type AbilityNodeDetail = {
  id: string;
  parentId?: string | null;
  name: string;
  description?: string | null;
  level: number;
  evidenceItems: AbilityEvidence[];
  children: AbilityNodeDetail[];
};

type ListAbilityNodesResponse = {
  items: AbilityNodeDetail[];
};

type LifeDecision = {
  id: string;
  title: string;
  description?: string | null;
  deadline?: string | null;
  status: string;
  finalDecision?: string | null;
};

type LifeDecisionPath = {
  id: string;
  title: string;
  description?: string | null;
};

type LifeDecisionDetail = LifeDecision & {
  paths: LifeDecisionPath[];
};

type DecisionEvidence = {
  id: string;
  decisionId: string;
  pathId?: string | null;
  evidenceType: "support" | "against" | "neutral";
  content: string;
  weight?: number | null;
  sourceCitationId?: string | null;
  createdAt: string;
  updatedAt: string;
};

type ExternalSourceSearchCategory =
  | "ai_role"
  | "job_market"
  | "industry"
  | "postgraduate"
  | "other";

type ExternalSource = {
  id: string;
  lifeDecisionId?: string | null;
  title: string;
  sourceSite: string;
  url: string;
  publishedAt?: string | null;
  summary?: string | null;
  relationToDecision?: string | null;
};

type SearchExternalSourceItem = {
  title: string;
  sourceSite: string;
  url: string;
  publishedAt?: string | null;
  summary?: string | null;
  relationToDecision?: string | null;
};

type SearchExternalSourcesResponse = {
  query: string;
  category: ExternalSourceSearchCategory;
  searchMode: "fake" | "best_effort_web";
  summary: string;
  items: SearchExternalSourceItem[];
  savedItems: ExternalSource[];
  sourceSnapshot: {
    searchedAt: string;
    provider: string;
    requestedLimit: number;
    returnedResults: number;
    savedResults: number;
    lifeDecisionId?: string | null;
  };
};

type PaginationInput = {
  limit?: number;
  cursor?: string;
};

type ReadMemoriesArguments = {
  userId: string;
  memoryTypes?: string[];
  status?: string;
  query?: string;
  relatedLifeDecisionId?: string;
  pagination?: PaginationInput;
};

type CreateMemoryCandidateArguments = {
  userId: string;
  memoryType:
    | "goal"
    | "ability"
    | "value"
    | "event"
    | "relationship"
    | "recurring_problem"
    | "decision";
  content: string;
  sourceCitations: Array<{
    sourceType: string;
    sourceId: string;
    quote?: string;
    note?: string;
  }>;
  reason: string;
  confidence?: number;
  expiresAt?: string;
};

type ListDailyEntriesArguments = {
  userId: string;
  startDate?: string;
  endDate?: string;
  source?: string;
  includeStructuredSummary?: boolean;
  pagination?: PaginationInput;
};

type ListAbilityNodesArguments = {
  userId: string;
  rootNodeId?: string;
  maxDepth?: number;
  includeEvidenceSummary?: boolean;
};

type GetLifeDecisionArguments = {
  lifeDecisionId?: string;
  userId?: string;
  includePaths?: boolean;
  includeMetricRatings?: boolean;
};

type GenerateWeeklyReviewArguments = {
  userId: string;
  periodStart: string;
  periodEnd: string;
  lifeDecisionId?: string;
};

type GetLatestWeeklyReviewArguments = {
  userId: string;
  lifeDecisionId?: string;
};

type GetWeeklyReviewByPeriodArguments = {
  userId: string;
  periodStart: string;
  periodEnd: string;
  lifeDecisionId?: string;
};

type CreateDecisionEvidenceArguments = {
  decisionId: string;
  pathId?: string;
  evidenceType: "support" | "against" | "neutral";
  content: string;
  weight?: number;
  externalSourceId?: string;
  sourceCitations?: Array<{
    sourceType: string;
    sourceId: string;
    quote?: string;
  }>;
};

type CreateAbilityEvidenceCandidateArguments = {
  abilityNodeId: string;
  content: string;
  sourceCitations: Array<{
    sourceType: string;
    sourceId: string;
    quote?: string;
  }>;
  scores: {
    difficultyScore: number;
    independenceScore: number;
    impactScore: number;
    feedbackScore: number;
    recurrenceCount: number;
  };
  impact: "positive" | "negative" | "neutral";
};

type SearchExternalSourcesArguments = {
  query: string;
  category?: ExternalSourceSearchCategory;
  lifeDecisionId?: string;
  limit?: number;
  topic?:
    | "job_requirements"
    | "city_market"
    | "industry_trends"
    | "graduate_school"
    | "custom";
  region?: string;
  maxResults?: number;
  preferredSourceTypes?: string[];
};

type WeeklyReviewStructuredTextItem = {
  title?: string;
  detail: string;
  citationIds?: string[];
};

type WeeklyReviewEmotionPattern = {
  id: string;
  weeklyReviewId?: string | null;
  periodStart: string;
  periodEnd: string;
  dominantEmotions: string[];
  triggers: string[];
  patterns: WeeklyReviewStructuredTextItem[];
  decisionRisk?: string | null;
  createdAt: string;
  updatedAt: string;
};

type WeeklyReviewDetail = {
  id: string;
  lifeDecisionId?: string | null;
  periodStart: string;
  periodEnd: string;
  progressSummary?: string | null;
  abilityChanges: WeeklyReviewStructuredTextItem[];
  emotionPatterns: WeeklyReviewStructuredTextItem[];
  goalDrift?: string | null;
  nextWeekSuggestions: WeeklyReviewStructuredTextItem[];
  lifePossibilityNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  emotionPattern?: WeeklyReviewEmotionPattern | null;
  citations?: Array<{
    id: string;
    title?: string | null;
    url?: string | null;
    sourceType?: string | null;
  }>;
};

type WeeklyReviewGenerateResponse = {
  weeklyReview: WeeklyReviewDetail;
  generationMode: "deterministic";
  sourceSnapshot: {
    dailyEntriesRead: number;
    structuredReportsRead: number;
    metricRatingsRead: number;
    confirmedMemoriesRead: number;
    decisionEvidenceRead: number;
  };
};

type MemoryOutputItem = {
  memoryId: string;
  memoryType: string;
  content: string;
  status: string;
  confidence?: number;
  sourceCitations: Array<{
    sourceType?: string;
    sourceId?: string;
    quote?: string;
  }>;
};

type MemoryCandidateOutput = {
  candidateId: string;
  status: "candidate";
};

type DailyEntryOutputItem = {
  dailyEntryId: string;
  source: string;
  rawContent: string;
  structuredSummary?: string;
  createdAt: string;
};

type AbilityNodeOutputItem = {
  abilityNodeId: string;
  name: string;
  parentId?: string;
  description?: string;
  level: number;
  confirmedEvidenceCount: number;
};

type LifeDecisionOutput = {
  lifeDecisionId: string;
  title: string;
  description?: string;
  deadline?: string;
  status: string;
  finalDecision?: string;
  paths?: Array<{
    pathId?: string;
    title?: string;
    description?: string;
  }>;
  metricRatings?: Array<{
    metricName?: string;
    score?: number;
    rationale?: string;
  }>;
};

type WeeklyReviewOutput = {
  weeklyReviewId: string;
  lifeDecisionId?: string;
  periodStart: string;
  periodEnd: string;
  progressSummary?: string;
  abilityChanges: WeeklyReviewStructuredTextItem[];
  emotionPatterns: WeeklyReviewStructuredTextItem[];
  goalDrift?: string;
  nextWeekSuggestions: WeeklyReviewStructuredTextItem[];
  lifePossibilityNotes?: string;
  createdAt: string;
  updatedAt: string;
  emotionPattern?: {
    emotionPatternId: string;
    weeklyReviewId?: string;
    periodStart: string;
    periodEnd: string;
    dominantEmotions: string[];
    triggers: string[];
    patterns: WeeklyReviewStructuredTextItem[];
    decisionRisk?: string;
    createdAt: string;
    updatedAt: string;
  };
  citations?: Array<{
    citationId: string;
    title?: string;
    url?: string;
    sourceType?: string;
  }>;
};

type DecisionEvidenceOutput = {
  decisionEvidenceId: string;
  sourceCitationId?: string;
};

type AbilityEvidenceCandidateOutput = {
  candidateId: string;
  status: "candidate";
};

type SearchExternalSourcesOutput = {
  results: Array<{
    title: string;
    sourceSite: string;
    url: string;
    publishedAt?: string;
    summary?: string;
  }>;
  summary: string;
  searchMode: "fake" | "best_effort_web";
  sourceSnapshot: SearchExternalSourcesResponse["sourceSnapshot"];
  savedItems: Array<{
    externalSourceId: string;
    title: string;
    sourceSite: string;
    url: string;
    summary?: string;
    relationToDecision?: string;
  }>;
};

export interface CreateDigitalSelfMcpServerWithApiHandlersOptions
  extends DigitalSelfMcpServerOptions,
    DigitalSelfApiClientOptions {}

function asOptionalString(value: string | null | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function toToolErrorResult(
  toolName: string,
  error: unknown,
): McpToolExecutionResult {
  if (error instanceof DigitalSelfApiClientError) {
    return createMcpToolErrorResult(toolName, error.code ?? "API_ERROR", error.message, {
      status: error.status,
      requestId: error.requestId,
      details: error.details,
    });
  }

  return createMcpToolErrorResult(
    toolName,
    "TOOL_EXECUTION_FAILED",
    error instanceof Error ? error.message : `MCP tool "${toolName}" failed.`,
  );
}

function sortByCreatedAtDesc<T extends { createdAt?: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftValue = typeof left.createdAt === "string" ? left.createdAt : "";
    const rightValue = typeof right.createdAt === "string" ? right.createdAt : "";

    return rightValue.localeCompare(leftValue);
  });
}

function getRequestedLimit(pagination?: PaginationInput): number | undefined {
  return typeof pagination?.limit === "number" ? pagination.limit : undefined;
}

function addSearchParam(
  searchParams: URLSearchParams,
  key: string,
  value: string | number | undefined,
): void {
  if (value === undefined) {
    return;
  }

  searchParams.set(key, String(value));
}

function mapMemoryItem(memory: Memory): MemoryOutputItem {
  return {
    memoryId: memory.id,
    memoryType: memory.memoryType,
    content: memory.content,
    status: memory.status,
    confidence: typeof memory.confidence === "number" ? memory.confidence : undefined,
    sourceCitations: memory.sourceCitationId
      ? [
          {
            sourceId: memory.sourceCitationId,
          },
        ]
      : [],
  };
}

function mapMemoryCandidateOutput(memory: Memory): MemoryCandidateOutput {
  return {
    candidateId: memory.id,
    status: "candidate",
  };
}

function mapStructuredSummary(structuredReport?: StructuredDailyReport | null): string | undefined {
  if (!structuredReport) {
    return undefined;
  }

  const sections: Array<[label: string, items: Array<{ title?: string; detail: string }>]> = [
    ["facts", structuredReport.facts],
    ["emotions", structuredReport.emotions],
    ["workItems", structuredReport.workItems],
    ["feedback", structuredReport.feedback],
    ["growthEvidence", structuredReport.growthEvidence],
    ["drainSources", structuredReport.drainSources],
    ["nextActions", structuredReport.nextActions],
    ["decisionImpact", structuredReport.decisionImpact],
  ];

  const lines = sections.flatMap(([label, items]) => {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const details = items
      .map((item) => {
        const title = asOptionalString(item.title);
        return title ? `${title}: ${item.detail}` : item.detail;
      })
      .join(" | ");

    return [`${label}: ${details}`];
  });

  return lines.length > 0 ? lines.join("\n") : undefined;
}

function mapDailyEntryItem(
  item: {
    id: string;
    source: string;
    rawContent: string;
    createdAt: string;
  },
  structuredSummary?: string,
): DailyEntryOutputItem {
  return {
    dailyEntryId: item.id,
    source: item.source,
    rawContent: item.rawContent,
    structuredSummary,
    createdAt: item.createdAt,
  };
}

function flattenAbilityNodes(
  nodes: AbilityNodeDetail[],
  options: {
    maxDepth?: number;
    depth?: number;
  } = {},
): AbilityNodeOutputItem[] {
  const depth = options.depth ?? 0;
  const maxDepth = options.maxDepth;
  const items: AbilityNodeOutputItem[] = [];

  for (const node of nodes) {
    const item: AbilityNodeOutputItem = {
      abilityNodeId: node.id,
      name: node.name,
      level: node.level,
      confirmedEvidenceCount: node.evidenceItems.filter(
        (item) => item.status === "confirmed",
      ).length,
    };

    const parentId = asOptionalString(node.parentId);
    const description = asOptionalString(node.description);

    if (parentId !== undefined) {
      item.parentId = parentId;
    }

    if (description !== undefined) {
      item.description = description;
    }

    items.push(item);

    if (maxDepth !== undefined && depth >= maxDepth) {
      continue;
    }

    items.push(
      ...flattenAbilityNodes(node.children, {
        maxDepth,
        depth: depth + 1,
      }),
    );
  }

  return items;
}

function findAbilityNodeInForest(
  nodes: AbilityNodeDetail[],
  targetId: string,
): AbilityNodeDetail | null {
  for (const node of nodes) {
    if (node.id === targetId) {
      return node;
    }

    const childMatch = findAbilityNodeInForest(node.children, targetId);

    if (childMatch) {
      return childMatch;
    }
  }

  return null;
}

function mapLifeDecisionOutput(
  lifeDecision: LifeDecisionDetail,
  options: {
    includePaths: boolean;
    includeMetricRatings: boolean;
  },
): LifeDecisionOutput {
  const output: LifeDecisionOutput = {
    lifeDecisionId: lifeDecision.id,
    title: lifeDecision.title,
    status: lifeDecision.status,
    paths: options.includePaths
      ? lifeDecision.paths.map((path) => ({
          pathId: path.id,
          title: path.title,
          description: asOptionalString(path.description),
        }))
      : undefined,
    metricRatings: options.includeMetricRatings ? [] : undefined,
  };

  const description = asOptionalString(lifeDecision.description);
  const deadline = asOptionalString(lifeDecision.deadline);
  const finalDecision = asOptionalString(lifeDecision.finalDecision);

  if (description !== undefined) {
    output.description = description;
  }

  if (deadline !== undefined) {
    output.deadline = deadline;
  }

  if (finalDecision !== undefined) {
    output.finalDecision = finalDecision;
  }

  return output;
}

function mapDecisionEvidenceOutput(evidence: DecisionEvidence): DecisionEvidenceOutput {
  const output: DecisionEvidenceOutput = {
    decisionEvidenceId: evidence.id,
  };

  if (evidence.sourceCitationId) {
    output.sourceCitationId = evidence.sourceCitationId;
  }

  return output;
}

function mapWeeklyReviewStructuredTextItems(
  items: WeeklyReviewStructuredTextItem[],
): WeeklyReviewStructuredTextItem[] {
  return items.map((item) => {
    const output: WeeklyReviewStructuredTextItem = {
      detail: item.detail,
    };
    const title = asOptionalString(item.title);

    if (title !== undefined) {
      output.title = title;
    }

    if (Array.isArray(item.citationIds) && item.citationIds.length > 0) {
      output.citationIds = item.citationIds.filter(
        (citationId): citationId is string => typeof citationId === "string",
      );
    }

    return output;
  });
}

function mapWeeklyReviewOutput(review: WeeklyReviewDetail): WeeklyReviewOutput {
  const output: WeeklyReviewOutput = {
    weeklyReviewId: review.id,
    periodStart: review.periodStart,
    periodEnd: review.periodEnd,
    abilityChanges: mapWeeklyReviewStructuredTextItems(review.abilityChanges),
    emotionPatterns: mapWeeklyReviewStructuredTextItems(review.emotionPatterns),
    nextWeekSuggestions: mapWeeklyReviewStructuredTextItems(review.nextWeekSuggestions),
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };

  const lifeDecisionId = asOptionalString(review.lifeDecisionId);
  const progressSummary = asOptionalString(review.progressSummary);
  const goalDrift = asOptionalString(review.goalDrift);
  const lifePossibilityNotes = asOptionalString(review.lifePossibilityNotes);

  if (lifeDecisionId !== undefined) {
    output.lifeDecisionId = lifeDecisionId;
  }

  if (progressSummary !== undefined) {
    output.progressSummary = progressSummary;
  }

  if (goalDrift !== undefined) {
    output.goalDrift = goalDrift;
  }

  if (lifePossibilityNotes !== undefined) {
    output.lifePossibilityNotes = lifePossibilityNotes;
  }

  if (review.emotionPattern) {
    output.emotionPattern = {
      emotionPatternId: review.emotionPattern.id,
      weeklyReviewId: asOptionalString(review.emotionPattern.weeklyReviewId),
      periodStart: review.emotionPattern.periodStart,
      periodEnd: review.emotionPattern.periodEnd,
      dominantEmotions: review.emotionPattern.dominantEmotions,
      triggers: review.emotionPattern.triggers,
      patterns: mapWeeklyReviewStructuredTextItems(review.emotionPattern.patterns),
      decisionRisk: asOptionalString(review.emotionPattern.decisionRisk),
      createdAt: review.emotionPattern.createdAt,
      updatedAt: review.emotionPattern.updatedAt,
    };
  }

  if (Array.isArray(review.citations) && review.citations.length > 0) {
    output.citations = review.citations.map((citation) => {
      const mappedCitation: NonNullable<WeeklyReviewOutput["citations"]>[number] = {
        citationId: citation.id,
      };
      const title = asOptionalString(citation.title);
      const url = asOptionalString(citation.url);
      const sourceType = asOptionalString(citation.sourceType);

      if (title !== undefined) {
        mappedCitation.title = title;
      }

      if (url !== undefined) {
        mappedCitation.url = url;
      }

      if (sourceType !== undefined) {
        mappedCitation.sourceType = sourceType;
      }

      return mappedCitation;
    });
  }

  return output;
}

function mapAbilityEvidenceCandidateOutput(
  evidence: AbilityEvidence,
): AbilityEvidenceCandidateOutput {
  return {
    candidateId: evidence.id,
    status: "candidate",
  };
}

function mapSearchTopicToCategory(
  topic?: SearchExternalSourcesArguments["topic"],
): ExternalSourceSearchCategory | undefined {
  if (!topic) {
    return undefined;
  }

  const topicCategoryMap: Record<
    NonNullable<SearchExternalSourcesArguments["topic"]>,
    ExternalSourceSearchCategory
  > = {
    job_requirements: "ai_role",
    city_market: "job_market",
    industry_trends: "industry",
    graduate_school: "postgraduate",
    custom: "other",
  };

  return topicCategoryMap[topic];
}

function buildExternalSearchQuery(argumentsInput: SearchExternalSourcesArguments): string {
  const additions = [
    argumentsInput.region,
    ...(argumentsInput.preferredSourceTypes ?? []),
  ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);

  return [argumentsInput.query, ...additions].join(" ");
}

function mapExternalSourceSearchOutput(
  response: SearchExternalSourcesResponse,
): SearchExternalSourcesOutput {
  return {
    results: response.items.map((item) => {
      const output: SearchExternalSourcesOutput["results"][number] = {
        title: item.title,
        sourceSite: item.sourceSite,
        url: item.url,
      };
      const publishedAt = asOptionalString(item.publishedAt);
      const summary = asOptionalString(item.summary);

      if (publishedAt !== undefined) {
        output.publishedAt = publishedAt;
      }

      if (summary !== undefined) {
        output.summary = summary;
      }

      return output;
    }),
    summary: response.summary,
    searchMode: response.searchMode,
    sourceSnapshot: response.sourceSnapshot,
    savedItems: response.savedItems.map((item) => {
      const output: SearchExternalSourcesOutput["savedItems"][number] = {
        externalSourceId: item.id,
        title: item.title,
        sourceSite: item.sourceSite,
        url: item.url,
      };
      const summary = asOptionalString(item.summary);
      const relationToDecision = asOptionalString(item.relationToDecision);

      if (summary !== undefined) {
        output.summary = summary;
      }

      if (relationToDecision !== undefined) {
        output.relationToDecision = relationToDecision;
      }

      return output;
    }),
  };
}

function createReadMemoriesHandler(
  apiClient: ReturnType<typeof createDigitalSelfApiClient>,
): McpToolHandler {
  return async (arguments_, context) => {
    const argumentsInput = arguments_ as ReadMemoriesArguments;
    const limit = getRequestedLimit(argumentsInput.pagination);
    const unsupportedFilters: string[] = [];

    if (argumentsInput.relatedLifeDecisionId) {
      unsupportedFilters.push("relatedLifeDecisionId");
    }

    try {
      const memoryTypes =
        Array.isArray(argumentsInput.memoryTypes) &&
        argumentsInput.memoryTypes.length > 0
          ? argumentsInput.memoryTypes
          : [undefined];

      const responses = await Promise.all(
        memoryTypes.map((memoryType) => {
          const searchParams = new URLSearchParams();
          addSearchParam(searchParams, "limit", limit);
          addSearchParam(searchParams, "offset", 0);
          addSearchParam(searchParams, "status", argumentsInput.status);
          addSearchParam(searchParams, "memoryType", memoryType);

          return apiClient.get<ListMemoriesResponse>("/api/memories", {
            searchParams,
            signal: context.signal,
          });
        }),
      );

      const requestIds = responses.map(
        (response: DigitalSelfApiResponse<ListMemoriesResponse>) => response.requestId,
      );
      const items = sortByCreatedAtDesc(
        dedupeById(
          responses.flatMap(
            (response: DigitalSelfApiResponse<ListMemoriesResponse>) => response.data.items,
          ),
        ),
      );

      const query = argumentsInput.query?.trim().toLowerCase();
      const filteredItems = items.filter((item: Memory) => {
        if (query && !item.content.toLowerCase().includes(query)) {
          return false;
        }

        return true;
      });

      const limitedItems =
        typeof limit === "number" ? filteredItems.slice(0, limit) : filteredItems;

      return {
        content: [
          {
            type: "text",
            text:
              unsupportedFilters.length > 0
                ? `Retrieved ${limitedItems.length} memories. Ignored unsupported filters: ${unsupportedFilters.join(", ")}.`
                : `Retrieved ${limitedItems.length} memories.`,
          },
        ],
        structuredContent: {
          items: limitedItems.map(mapMemoryItem),
        },
        _meta: {
          apiRequestIds: requestIds,
          unsupportedFilters,
        },
      };
    } catch (error) {
      return toToolErrorResult("read_memories", error);
    }
  };
}

function createCreateMemoryCandidateHandler(
  apiClient: ReturnType<typeof createDigitalSelfApiClient>,
): McpToolHandler {
  return async (arguments_, context) => {
    const argumentsInput = arguments_ as CreateMemoryCandidateArguments;

    if (argumentsInput.sourceCitations.length > 0) {
      return createMcpToolErrorResult(
        "create_memory_candidate",
        "UNSUPPORTED_SOURCE_CITATIONS",
        "Memory source citations are not supported by the current MCP schema-to-REST mapping. Create the candidate without sourceCitations, or wait until citation mapping is implemented.",
        {
          unsupportedSourceCitations: argumentsInput.sourceCitations,
        },
      );
    }

    try {
      const response = await apiClient.post<Memory>("/api/memories", {
        body: {
          memoryType: argumentsInput.memoryType,
          content: argumentsInput.content,
          status: "candidate",
          confidence: argumentsInput.confidence,
          expiresAt: argumentsInput.expiresAt,
        },
        signal: context.signal,
      });

      return {
        content: [
          {
            type: "text",
            text: `Created memory candidate ${response.data.id}.`,
          },
        ],
        structuredContent: mapMemoryCandidateOutput(response.data),
        _meta: {
          apiRequestId: response.requestId,
          ignoredUserId: true,
          reason: argumentsInput.reason,
        },
      };
    } catch (error) {
      return toToolErrorResult("create_memory_candidate", error);
    }
  };
}

function createListDailyEntriesHandler(
  apiClient: ReturnType<typeof createDigitalSelfApiClient>,
): McpToolHandler {
  return async (arguments_, context) => {
    const argumentsInput = arguments_ as ListDailyEntriesArguments;
    try {
      const searchParams = new URLSearchParams();
      addSearchParam(searchParams, "limit", getRequestedLimit(argumentsInput.pagination));
      addSearchParam(searchParams, "offset", 0);
      addSearchParam(searchParams, "from", argumentsInput.startDate);
      addSearchParam(searchParams, "to", argumentsInput.endDate);

      const response = await apiClient.get<ListDailyEntriesResponse>("/api/daily-entries", {
        searchParams,
        signal: context.signal,
      });

      const filteredItems = response.data.items.filter((item: DailyEntryListItem) => {
        if (argumentsInput.source && item.source !== argumentsInput.source) {
          return false;
        }

        return true;
      });

      let structuredSummariesById = new Map<string, string | undefined>();

      if (argumentsInput.includeStructuredSummary) {
        const detailResponses = await Promise.all(
          filteredItems.map((item: DailyEntryListItem) =>
            apiClient.get<DailyEntryDetailResponse>(`/api/daily-entries/${item.id}`, {
              signal: context.signal,
            }),
          ),
        );

        structuredSummariesById = new Map(
          detailResponses.map((detailResponse: DigitalSelfApiResponse<DailyEntryDetailResponse>) => [
            detailResponse.data.id,
            mapStructuredSummary(detailResponse.data.structuredReport),
          ]),
        );
      }

      return {
        content: [
          {
            type: "text",
            text: `Retrieved ${filteredItems.length} daily entries.`,
          },
        ],
        structuredContent: {
          items: filteredItems.map((item: DailyEntryListItem) =>
            mapDailyEntryItem(item, structuredSummariesById.get(item.id)),
          ),
        },
        _meta: {
          apiRequestId: response.requestId,
        },
      };
    } catch (error) {
      return toToolErrorResult("list_daily_entries", error);
    }
  };
}

function createListAbilityNodesHandler(
  apiClient: ReturnType<typeof createDigitalSelfApiClient>,
): McpToolHandler {
  return async (arguments_, context) => {
    const argumentsInput = arguments_ as ListAbilityNodesArguments;
    try {
      const response = await apiClient.get<ListAbilityNodesResponse>("/api/ability-nodes", {
        signal: context.signal,
      });

      const forest = response.data.items;
      const rootNodes = argumentsInput.rootNodeId
        ? [findAbilityNodeInForest(forest, argumentsInput.rootNodeId)].filter(
            (node): node is AbilityNodeDetail => node !== null,
          )
        : forest;

      if (argumentsInput.rootNodeId && rootNodes.length === 0) {
        return createMcpToolErrorResult(
          "list_ability_nodes",
          "NOT_FOUND",
          `Ability node ${argumentsInput.rootNodeId} was not found.`,
        );
      }

      const items = flattenAbilityNodes(rootNodes, {
        maxDepth: argumentsInput.maxDepth,
      });

      return {
        content: [
          {
            type: "text",
            text: `Retrieved ${items.length} ability nodes.`,
          },
        ],
        structuredContent: {
          items,
        },
        _meta: {
          apiRequestId: response.requestId,
          includeEvidenceSummary: argumentsInput.includeEvidenceSummary ?? true,
        },
      };
    } catch (error) {
      return toToolErrorResult("list_ability_nodes", error);
    }
  };
}

function createGetLifeDecisionHandler(
  apiClient: ReturnType<typeof createDigitalSelfApiClient>,
): McpToolHandler {
  return async (arguments_, context) => {
    const argumentsInput = arguments_ as GetLifeDecisionArguments;
    const includePaths = argumentsInput.includePaths ?? true;
    const includeMetricRatings = argumentsInput.includeMetricRatings ?? false;

    try {
      let lifeDecisionId = argumentsInput.lifeDecisionId;
      let listResponse: DigitalSelfApiResponse<LifeDecision[]> | null = null;

      if (!lifeDecisionId) {
        listResponse = await apiClient.get<LifeDecision[]>("/api/life-decisions", {
          searchParams: new URLSearchParams({
            status: "active",
          }),
          signal: context.signal,
        });

        lifeDecisionId = listResponse.data[0]?.id;
      }

      if (!lifeDecisionId) {
        return createMcpToolErrorResult(
          "get_life_decision",
          "NOT_FOUND",
          "No active life decision was found.",
        );
      }

      const detailResponse = await apiClient.get<LifeDecisionDetail>(
        `/api/life-decisions/${lifeDecisionId}`,
        {
          signal: context.signal,
        },
      );

      return {
        content: [
          {
            type: "text",
            text: `Retrieved life decision ${detailResponse.data.title}.`,
          },
        ],
        structuredContent: {
          lifeDecision: mapLifeDecisionOutput(detailResponse.data, {
            includePaths,
            includeMetricRatings,
          }),
        },
        _meta: {
          apiRequestIds: [listResponse?.requestId, detailResponse.requestId].filter(Boolean),
        },
      };
    } catch (error) {
      return toToolErrorResult("get_life_decision", error);
    }
  };
}

function createCreateAbilityEvidenceCandidateHandler(
  apiClient: ReturnType<typeof createDigitalSelfApiClient>,
): McpToolHandler {
  return async (arguments_, context) => {
    const argumentsInput = arguments_ as CreateAbilityEvidenceCandidateArguments;

    if (argumentsInput.sourceCitations.length > 0) {
      return createMcpToolErrorResult(
        "create_ability_evidence_candidate",
        "UNSUPPORTED_SOURCE_CITATIONS",
        "AbilityEvidence source citations are not supported by the current MCP schema-to-REST mapping. Create the candidate without sourceCitations, or wait until citation mapping is implemented.",
        {
          unsupportedSourceCitations: argumentsInput.sourceCitations,
        },
      );
    }

    try {
      const response = await apiClient.post<AbilityEvidence>("/api/ability-evidence", {
        body: {
          abilityNodeId: argumentsInput.abilityNodeId,
          content: argumentsInput.content,
          impact: argumentsInput.impact,
          difficultyScore: argumentsInput.scores.difficultyScore,
          independenceScore: argumentsInput.scores.independenceScore,
          impactScore: argumentsInput.scores.impactScore,
          feedbackScore: argumentsInput.scores.feedbackScore,
          recurrenceCount: argumentsInput.scores.recurrenceCount,
          status: "candidate",
        },
        signal: context.signal,
      });

      return {
        content: [
          {
            type: "text",
            text: `Created ability evidence candidate ${response.data.id}.`,
          },
        ],
        structuredContent: mapAbilityEvidenceCandidateOutput(response.data),
        _meta: {
          apiRequestId: response.requestId,
          ignoredUserId: true,
        },
      };
    } catch (error) {
      return toToolErrorResult("create_ability_evidence_candidate", error);
    }
  };
}

function createCreateDecisionEvidenceHandler(
  apiClient: ReturnType<typeof createDigitalSelfApiClient>,
): McpToolHandler {
  return async (arguments_, context) => {
    const argumentsInput = arguments_ as CreateDecisionEvidenceArguments;
    const sourceCitations = argumentsInput.sourceCitations ?? [];

    if (sourceCitations.length > 0) {
      return createMcpToolErrorResult(
        "create_decision_evidence",
        "UNSUPPORTED_SOURCE_CITATIONS",
        "Free-form DecisionEvidence sourceCitations are not mapped by the current MCP tool. Use externalSourceId to link a saved ExternalSource, or omit sourceCitations.",
        {
          unsupportedSourceCitations: sourceCitations,
        },
      );
    }

    try {
      const response = await apiClient.post<DecisionEvidence>("/api/decision-evidence", {
        body: {
          decisionId: argumentsInput.decisionId,
          pathId: argumentsInput.pathId,
          evidenceType: argumentsInput.evidenceType,
          content: argumentsInput.content,
          weight: argumentsInput.weight,
          externalSourceId: argumentsInput.externalSourceId,
        },
        signal: context.signal,
      });

      return {
        content: [
          {
            type: "text",
            text: `Created decision evidence ${response.data.id}.`,
          },
        ],
        structuredContent: mapDecisionEvidenceOutput(response.data),
        _meta: {
          apiRequestId: response.requestId,
          ignoredUserId: true,
        },
      };
    } catch (error) {
      return toToolErrorResult("create_decision_evidence", error);
    }
  };
}

function createGenerateWeeklyReviewHandler(
  apiClient: ReturnType<typeof createDigitalSelfApiClient>,
): McpToolHandler {
  return async (arguments_, context) => {
    const argumentsInput = arguments_ as GenerateWeeklyReviewArguments;

    try {
      const response = await apiClient.post<WeeklyReviewGenerateResponse>(
        "/api/weekly-reviews/generate",
        {
          body: {
            periodStart: argumentsInput.periodStart,
            periodEnd: argumentsInput.periodEnd,
            lifeDecisionId: argumentsInput.lifeDecisionId,
          },
          signal: context.signal,
        },
      );

      return {
        content: [
          {
            type: "text",
            text:
              `Generated deterministic weekly review ${response.data.weeklyReview.id}. ` +
              "This is a repeatable data summary, not a real AI deep analysis.",
          },
        ],
        structuredContent: {
          weeklyReview: mapWeeklyReviewOutput(response.data.weeklyReview),
          generationMode: response.data.generationMode,
          sourceSnapshot: response.data.sourceSnapshot,
        },
        _meta: {
          apiRequestId: response.requestId,
          ignoredUserId: true,
        },
      };
    } catch (error) {
      return toToolErrorResult("generate_weekly_review", error);
    }
  };
}

function createGetLatestWeeklyReviewHandler(
  apiClient: ReturnType<typeof createDigitalSelfApiClient>,
): McpToolHandler {
  return async (arguments_, context) => {
    const argumentsInput = arguments_ as GetLatestWeeklyReviewArguments;

    try {
      const searchParams = new URLSearchParams();
      addSearchParam(searchParams, "lifeDecisionId", argumentsInput.lifeDecisionId);

      const response = await apiClient.get<WeeklyReviewDetail | null>(
        "/api/weekly-reviews/latest",
        {
          searchParams,
          signal: context.signal,
        },
      );

      if (!response.data) {
        return createMcpToolErrorResult(
          "get_latest_weekly_review",
          "NOT_FOUND",
          "No weekly review was found for the current filters.",
          {
            lifeDecisionId: argumentsInput.lifeDecisionId,
            apiRequestId: response.requestId,
          },
        );
      }

      return {
        content: [
          {
            type: "text",
            text:
              `Retrieved weekly review ${response.data.id}. ` +
              "Stored weekly reviews are deterministic summaries, not real AI deep analysis.",
          },
        ],
        structuredContent: {
          weeklyReview: mapWeeklyReviewOutput(response.data),
        },
        _meta: {
          apiRequestId: response.requestId,
          ignoredUserId: true,
        },
      };
    } catch (error) {
      return toToolErrorResult("get_latest_weekly_review", error);
    }
  };
}

function createGetWeeklyReviewByPeriodHandler(
  apiClient: ReturnType<typeof createDigitalSelfApiClient>,
): McpToolHandler {
  return async (arguments_, context) => {
    const argumentsInput = arguments_ as GetWeeklyReviewByPeriodArguments;

    try {
      const searchParams = new URLSearchParams();
      addSearchParam(searchParams, "periodStart", argumentsInput.periodStart);
      addSearchParam(searchParams, "periodEnd", argumentsInput.periodEnd);
      addSearchParam(searchParams, "lifeDecisionId", argumentsInput.lifeDecisionId);

      const response = await apiClient.get<WeeklyReviewDetail | null>("/api/weekly-reviews", {
        searchParams,
        signal: context.signal,
      });

      if (!response.data) {
        return createMcpToolErrorResult(
          "get_weekly_review_by_period",
          "NOT_FOUND",
          "No weekly review was found for the requested period.",
          {
            periodStart: argumentsInput.periodStart,
            periodEnd: argumentsInput.periodEnd,
            lifeDecisionId: argumentsInput.lifeDecisionId,
            apiRequestId: response.requestId,
          },
        );
      }

      return {
        content: [
          {
            type: "text",
            text:
              `Retrieved weekly review ${response.data.id} for the requested period. ` +
              "Stored weekly reviews are deterministic summaries, not real AI deep analysis.",
          },
        ],
        structuredContent: {
          weeklyReview: mapWeeklyReviewOutput(response.data),
        },
        _meta: {
          apiRequestId: response.requestId,
          ignoredUserId: true,
        },
      };
    } catch (error) {
      return toToolErrorResult("get_weekly_review_by_period", error);
    }
  };
}

function createSearchExternalSourcesHandler(
  apiClient: ReturnType<typeof createDigitalSelfApiClient>,
): McpToolHandler {
  return async (arguments_, context) => {
    const argumentsInput = arguments_ as SearchExternalSourcesArguments;
    const category = argumentsInput.category ?? mapSearchTopicToCategory(argumentsInput.topic);
    const limit = argumentsInput.limit ?? argumentsInput.maxResults;

    try {
      const response = await apiClient.post<SearchExternalSourcesResponse>(
        "/api/external-sources/search",
        {
          body: {
            query: buildExternalSearchQuery(argumentsInput),
            category,
            lifeDecisionId: argumentsInput.lifeDecisionId,
            limit,
          },
          signal: context.signal,
        },
      );

      const output = mapExternalSourceSearchOutput(response.data);

      return {
        content: [
          {
            type: "text",
            text:
              `Saved ${output.savedItems.length} external sources from ${output.searchMode} search. ` +
              "These are best-effort source links and snippets; users must open the URLs and verify important claims before using them as decision evidence.",
          },
        ],
        structuredContent: output,
        _meta: {
          apiRequestId: response.requestId,
          ignoredCompatibilityFields: {
            topic: argumentsInput.topic,
            maxResults: argumentsInput.maxResults,
          },
        },
      };
    } catch (error) {
      return toToolErrorResult("search_external_sources", error);
    }
  };
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const itemById = new Map<string, T>();

  for (const item of items) {
    itemById.set(item.id, item);
  }

  return [...itemById.values()];
}

export function createDigitalSelfMcpApiHandlers(
  options: DigitalSelfApiClientOptions = {},
): McpToolHandlerMap {
  const apiClient = createDigitalSelfApiClient(options);

  return {
    read_memories: createReadMemoriesHandler(apiClient),
    create_memory_candidate: createCreateMemoryCandidateHandler(apiClient),
    list_daily_entries: createListDailyEntriesHandler(apiClient),
    list_ability_nodes: createListAbilityNodesHandler(apiClient),
    get_life_decision: createGetLifeDecisionHandler(apiClient),
    generate_weekly_review: createGenerateWeeklyReviewHandler(apiClient),
    get_latest_weekly_review: createGetLatestWeeklyReviewHandler(apiClient),
    get_weekly_review_by_period: createGetWeeklyReviewByPeriodHandler(apiClient),
    create_ability_evidence_candidate: createCreateAbilityEvidenceCandidateHandler(apiClient),
    create_decision_evidence: createCreateDecisionEvidenceHandler(apiClient),
    search_external_sources: createSearchExternalSourcesHandler(apiClient),
  };
}

export function createDigitalSelfMcpServerWithApiHandlers(
  options: CreateDigitalSelfMcpServerWithApiHandlersOptions = {},
): DigitalSelfMcpServer {
  const { apiBaseUrl, fetchFn, handlers, ...serverOptions } = options;

  return createDigitalSelfMcpServer({
    ...serverOptions,
    handlers: {
      ...createDigitalSelfMcpApiHandlers({
        apiBaseUrl,
        fetchFn,
      }),
      ...handlers,
    },
  });
}
