export type JsonSchemaType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "object"
  | "array";

export interface JsonSchemaDraft {
  type: JsonSchemaType;
  description?: string;
  enum?: Array<string | number | boolean>;
  properties?: Record<string, JsonSchemaDraft>;
  items?: JsonSchemaDraft;
  required?: string[];
  additionalProperties?: boolean;
}

export interface McpToolDefinition {
  name: McpToolName;
  description: string;
  inputSchema: JsonSchemaDraft;
  outputSchema: JsonSchemaDraft;
}

export type McpToolName =
  | "read_memories"
  | "create_memory_candidate"
  | "list_daily_entries"
  | "list_ability_nodes"
  | "create_ability_evidence_candidate"
  | "get_life_decision"
  | "generate_weekly_review"
  | "get_latest_weekly_review"
  | "get_weekly_review_by_period"
  | "create_decision_evidence"
  | "send_feishu_message"
  | "search_external_sources"
  | "parse_resume_file";

const paginationSchema: JsonSchemaDraft = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: {
      type: "integer",
      description: "Max items to return.",
    },
    cursor: {
      type: "string",
      description: "Opaque pagination cursor for next page fetch.",
    },
  },
};

const structuredTextItemSchema: JsonSchemaDraft = {
  type: "object",
  additionalProperties: false,
  required: ["detail"],
  properties: {
    title: { type: "string" },
    detail: { type: "string" },
    citationIds: {
      type: "array",
      items: { type: "string" },
    },
  },
};

const emotionPatternSchema: JsonSchemaDraft = {
  type: "object",
  additionalProperties: false,
  required: [
    "emotionPatternId",
    "periodStart",
    "periodEnd",
    "dominantEmotions",
    "triggers",
    "patterns",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    emotionPatternId: { type: "string" },
    weeklyReviewId: { type: "string" },
    periodStart: { type: "string" },
    periodEnd: { type: "string" },
    dominantEmotions: {
      type: "array",
      items: { type: "string" },
    },
    triggers: {
      type: "array",
      items: { type: "string" },
    },
    patterns: {
      type: "array",
      items: structuredTextItemSchema,
    },
    decisionRisk: { type: "string" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const weeklyReviewSchema: JsonSchemaDraft = {
  type: "object",
  additionalProperties: false,
  required: [
    "weeklyReviewId",
    "periodStart",
    "periodEnd",
    "abilityChanges",
    "emotionPatterns",
    "nextWeekSuggestions",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    weeklyReviewId: { type: "string" },
    lifeDecisionId: { type: "string" },
    periodStart: { type: "string" },
    periodEnd: { type: "string" },
    progressSummary: { type: "string" },
    abilityChanges: {
      type: "array",
      items: structuredTextItemSchema,
    },
    emotionPatterns: {
      type: "array",
      items: structuredTextItemSchema,
    },
    goalDrift: { type: "string" },
    nextWeekSuggestions: {
      type: "array",
      items: structuredTextItemSchema,
    },
    lifePossibilityNotes: { type: "string" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
    emotionPattern: emotionPatternSchema,
    citations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["citationId"],
        properties: {
          citationId: { type: "string" },
          title: { type: "string" },
          url: { type: "string" },
          sourceType: { type: "string" },
        },
      },
    },
  },
};

export const mcpToolDefinitions: ReadonlyArray<McpToolDefinition> = [
  {
    name: "read_memories",
    description: "Read confirmed or candidate memories with filters for type, date, and decision relevance.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["userId"],
      properties: {
        userId: { type: "string" },
        memoryTypes: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "goal",
              "ability",
              "value",
              "event",
              "relationship",
              "recurring_problem",
              "decision",
            ],
          },
        },
        status: {
          type: "string",
          enum: ["candidate", "confirmed", "rejected", "expired"],
        },
        query: { type: "string" },
        relatedLifeDecisionId: { type: "string" },
        pagination: paginationSchema,
      },
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["items"],
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            required: ["memoryId", "memoryType", "content", "status"],
            properties: {
              memoryId: { type: "string" },
              memoryType: { type: "string" },
              content: { type: "string" },
              status: { type: "string" },
              confidence: { type: "number" },
              sourceCitations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    sourceType: { type: "string" },
                    sourceId: { type: "string" },
                    quote: { type: "string" },
                  },
                },
              },
            },
          },
        },
        nextCursor: { type: "string" },
      },
    },
  },
  {
    name: "create_memory_candidate",
    description: "Create a pending memory candidate for later user confirmation.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["userId", "memoryType", "content", "sourceCitations", "reason"],
      properties: {
        userId: { type: "string" },
        memoryType: {
          type: "string",
          enum: [
            "goal",
            "ability",
            "value",
            "event",
            "relationship",
            "recurring_problem",
            "decision",
          ],
        },
        content: { type: "string" },
        sourceCitations: {
          type: "array",
          items: {
            type: "object",
            required: ["sourceType", "sourceId"],
            properties: {
              sourceType: { type: "string" },
              sourceId: { type: "string" },
              quote: { type: "string" },
              note: { type: "string" },
            },
          },
        },
        reason: { type: "string" },
        confidence: { type: "number" },
        expiresAt: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["candidateId", "status"],
      properties: {
        candidateId: { type: "string" },
        status: {
          type: "string",
          enum: ["candidate"],
        },
      },
    },
  },
  {
    name: "list_daily_entries",
    description: "List raw daily entries and optional linked structured report summary.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["userId"],
      properties: {
        userId: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        source: {
          type: "string",
          enum: ["feishu", "web", "import"],
        },
        includeStructuredSummary: { type: "boolean" },
        pagination: paginationSchema,
      },
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["items"],
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            required: ["dailyEntryId", "source", "rawContent", "createdAt"],
            properties: {
              dailyEntryId: { type: "string" },
              source: { type: "string" },
              rawContent: { type: "string" },
              structuredSummary: { type: "string" },
              createdAt: { type: "string" },
            },
          },
        },
        nextCursor: { type: "string" },
      },
    },
  },
  {
    name: "list_ability_nodes",
    description: "List ability tree nodes and optionally recent confirmed evidence counts.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["userId"],
      properties: {
        userId: { type: "string" },
        rootNodeId: { type: "string" },
        maxDepth: { type: "integer" },
        includeEvidenceSummary: { type: "boolean" },
      },
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["items"],
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            required: ["abilityNodeId", "name", "level"],
            properties: {
              abilityNodeId: { type: "string" },
              name: { type: "string" },
              parentId: { type: "string" },
              description: { type: "string" },
              level: { type: "integer" },
              confirmedEvidenceCount: { type: "integer" },
            },
          },
        },
      },
    },
  },
  {
    name: "create_ability_evidence_candidate",
    description: "Create a candidate ability evidence attachment for later user confirmation.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["abilityNodeId", "content", "sourceCitations", "impact", "scores"],
      properties: {
        abilityNodeId: { type: "string" },
        content: { type: "string" },
        sourceCitations: {
          type: "array",
          items: {
            type: "object",
            required: ["sourceType", "sourceId"],
            properties: {
              sourceType: { type: "string" },
              sourceId: { type: "string" },
              quote: { type: "string" },
            },
          },
        },
        scores: {
          type: "object",
          additionalProperties: false,
          required: [
            "difficultyScore",
            "independenceScore",
            "impactScore",
            "feedbackScore",
            "recurrenceCount",
          ],
          properties: {
            difficultyScore: { type: "integer" },
            independenceScore: { type: "integer" },
            impactScore: { type: "integer" },
            feedbackScore: { type: "integer" },
            recurrenceCount: { type: "integer" },
          },
        },
        impact: {
          type: "string",
          enum: ["positive", "negative", "neutral"],
        },
      },
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["candidateId", "status"],
      properties: {
        candidateId: { type: "string" },
        status: {
          type: "string",
          enum: ["candidate"],
        },
      },
    },
  },
  {
    name: "get_life_decision",
    description: "Fetch the active or specified life decision with paths and metric ratings.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        lifeDecisionId: { type: "string" },
        userId: { type: "string" },
        includePaths: { type: "boolean" },
        includeMetricRatings: { type: "boolean" },
      },
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["lifeDecision"],
      properties: {
        lifeDecision: {
          type: "object",
          required: ["lifeDecisionId", "title", "status"],
          properties: {
            lifeDecisionId: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            deadline: { type: "string" },
            status: { type: "string" },
            finalDecision: { type: "string" },
            paths: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  pathId: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
            metricRatings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  metricName: { type: "string" },
                  score: { type: "integer" },
                  rationale: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  },
  {
    name: "generate_weekly_review",
    description:
      "Generate a deterministic weekly review summary for a period. This is a repeatable aggregation of stored data, not a real AI deep analysis.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["userId", "periodStart", "periodEnd"],
      properties: {
        userId: {
          type: "string",
          description:
            "Compatibility field only. The REST API uses the server-side default user context and ignores this value.",
        },
        periodStart: { type: "string" },
        periodEnd: { type: "string" },
        lifeDecisionId: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["weeklyReview", "generationMode", "sourceSnapshot"],
      properties: {
        weeklyReview: weeklyReviewSchema,
        generationMode: {
          type: "string",
          enum: ["deterministic"],
        },
        sourceSnapshot: {
          type: "object",
          additionalProperties: false,
          required: [
            "dailyEntriesRead",
            "structuredReportsRead",
            "metricRatingsRead",
            "confirmedMemoriesRead",
            "decisionEvidenceRead",
          ],
          properties: {
            dailyEntriesRead: { type: "integer" },
            structuredReportsRead: { type: "integer" },
            metricRatingsRead: { type: "integer" },
            confirmedMemoriesRead: { type: "integer" },
            decisionEvidenceRead: { type: "integer" },
          },
        },
      },
    },
  },
  {
    name: "get_latest_weekly_review",
    description:
      "Get the latest stored weekly review, optionally scoped by lifeDecisionId. Stored results are deterministic summaries, not real AI deep analysis.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["userId"],
      properties: {
        userId: {
          type: "string",
          description:
            "Compatibility field only. The REST API uses the server-side default user context and ignores this value.",
        },
        lifeDecisionId: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["weeklyReview"],
      properties: {
        weeklyReview: weeklyReviewSchema,
      },
    },
  },
  {
    name: "get_weekly_review_by_period",
    description:
      "Get the stored weekly review for an exact period. The stored content is deterministic and does not claim real AI deep analysis.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["userId", "periodStart", "periodEnd"],
      properties: {
        userId: {
          type: "string",
          description:
            "Compatibility field only. The REST API uses the server-side default user context and ignores this value.",
        },
        periodStart: { type: "string" },
        periodEnd: { type: "string" },
        lifeDecisionId: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["weeklyReview"],
      properties: {
        weeklyReview: weeklyReviewSchema,
      },
    },
  },
  {
    name: "create_decision_evidence",
    description:
      "Create a decision evidence record linked to a life decision and optional path. Supports linking a saved ExternalSource via externalSourceId.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["decisionId", "content", "evidenceType"],
      properties: {
        decisionId: { type: "string" },
        pathId: { type: "string" },
        evidenceType: {
          type: "string",
          enum: ["support", "against", "neutral"],
        },
        content: { type: "string" },
        weight: { type: "number" },
        externalSourceId: {
          type: "string",
          description:
            "Optional saved ExternalSource id. The API will validate ownership and create or reuse the linked SourceCitation.",
        },
        sourceCitations: {
          type: "array",
          description:
            "Deprecated placeholder for future richer citation mapping. Free-form citations are not sent through this MCP tool; use externalSourceId instead.",
          items: {
            type: "object",
            required: ["sourceType", "sourceId"],
            properties: {
              sourceType: { type: "string" },
              sourceId: { type: "string" },
              quote: { type: "string" },
            },
          },
        },
      },
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["decisionEvidenceId"],
      properties: {
        decisionEvidenceId: { type: "string" },
        sourceCitationId: { type: "string" },
      },
    },
  },
  {
    name: "send_feishu_message",
    description: "Send a plain text or markdown Feishu message to a configured user or chat target.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["targetId", "message"],
      properties: {
        targetId: { type: "string" },
        targetType: {
          type: "string",
          enum: ["user", "chat"],
        },
        messageFormat: {
          type: "string",
          enum: ["text", "markdown"],
        },
        message: { type: "string" },
        idempotencyKey: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["deliveryStatus"],
      properties: {
        deliveryStatus: {
          type: "string",
          enum: ["queued", "sent", "failed"],
        },
        messageId: { type: "string" },
        errorMessage: { type: "string" },
      },
    },
  },
  {
    name: "search_external_sources",
    description: "Search external sources related to careers, schools, and market trends with citations.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: { type: "string" },
        category: {
          type: "string",
          enum: ["ai_role", "job_market", "industry", "postgraduate", "other"],
        },
        lifeDecisionId: { type: "string" },
        limit: { type: "integer" },
        topic: {
          type: "string",
          enum: [
            "job_requirements",
            "city_market",
            "industry_trends",
            "graduate_school",
            "custom",
          ],
        },
        region: { type: "string" },
        maxResults: { type: "integer" },
        preferredSourceTypes: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "job_board",
              "company_jd",
              "school_official",
              "industry_report",
              "news",
              "social_post",
            ],
          },
        },
      },
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["results", "summary", "searchMode", "sourceSnapshot", "savedItems"],
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            required: ["title", "sourceSite", "url"],
            properties: {
              title: { type: "string" },
              sourceSite: { type: "string" },
              url: { type: "string" },
              publishedAt: { type: "string" },
              summary: { type: "string" },
            },
          },
        },
        summary: { type: "string" },
        searchMode: {
          type: "string",
          enum: ["fake", "best_effort_web"],
        },
        sourceSnapshot: {
          type: "object",
          additionalProperties: false,
          required: [
            "searchedAt",
            "provider",
            "requestedLimit",
            "returnedResults",
            "savedResults",
          ],
          properties: {
            searchedAt: { type: "string" },
            provider: { type: "string" },
            requestedLimit: { type: "integer" },
            returnedResults: { type: "integer" },
            savedResults: { type: "integer" },
            lifeDecisionId: { type: "string" },
          },
        },
        savedItems: {
          type: "array",
          items: {
            type: "object",
            required: ["externalSourceId", "title", "sourceSite", "url"],
            properties: {
              externalSourceId: { type: "string" },
              title: { type: "string" },
              sourceSite: { type: "string" },
              url: { type: "string" },
              summary: { type: "string" },
              relationToDecision: { type: "string" },
            },
          },
        },
      },
    },
  },
  {
    name: "parse_resume_file",
    description: "Parse a resume file into normalized text and section-level structure.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["importedFileId"],
      properties: {
        importedFileId: { type: "string" },
        fileType: {
          type: "string",
          enum: ["pdf", "word", "txt", "markdown"],
        },
        parseMode: {
          type: "string",
          enum: ["plain-text", "sectioned"],
        },
      },
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["plainText"],
      properties: {
        plainText: { type: "string" },
        sections: {
          type: "array",
          items: {
            type: "object",
            required: ["sectionName", "content"],
            properties: {
              sectionName: { type: "string" },
              content: { type: "string" },
            },
          },
        },
        warnings: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
  },
];

export const mcpToolDefinitionMap: Readonly<Record<McpToolName, McpToolDefinition>> =
  Object.freeze(
    mcpToolDefinitions.reduce<Record<McpToolName, McpToolDefinition>>(
      (definitions, definition) => {
        definitions[definition.name] = definition;
        return definitions;
      },
      {} as Record<McpToolName, McpToolDefinition>,
    ),
  );

export function isMcpToolName(value: string): value is McpToolName {
  return value in mcpToolDefinitionMap;
}

export function getMcpToolDefinition(
  name: string,
): McpToolDefinition | undefined {
  if (!isMcpToolName(name)) {
    return undefined;
  }

  return mcpToolDefinitionMap[name];
}

export function getMcpToolInputSchema(
  name: string,
): JsonSchemaDraft | undefined {
  return getMcpToolDefinition(name)?.inputSchema;
}

export function listMcpTools(): ReadonlyArray<McpToolDefinition> {
  return mcpToolDefinitions;
}
