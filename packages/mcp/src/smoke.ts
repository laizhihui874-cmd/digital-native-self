import assert from "node:assert/strict";
import http from "node:http";

import { createDigitalSelfMcpServerWithApiHandlers } from "./api-handlers";

function createJsonResponse(data: unknown, requestId: string) {
  return JSON.stringify({
    data,
    error: null,
    requestId,
  });
}

async function startStubApiServer(): Promise<{
  apiBaseUrl: string;
  close: () => Promise<void>;
}> {
  const weeklyReviewDetail = {
    id: "weekly-review-1",
    userId: "user-1",
    lifeDecisionId: "decision-1",
    periodStart: "2026-06-15T00:00:00.000Z",
    periodEnd: "2026-06-21T23:59:59.999Z",
    progressSummary: "Completed the bounded MCP weekly review integration.",
    abilityChanges: [
      {
        title: "Integration",
        detail: "Connected MCP handlers to the weekly review REST endpoints.",
        citationIds: ["citation-1"],
      },
    ],
    emotionPatterns: [
      {
        detail: "Calmer progress once the schema and handler boundaries were fixed.",
      },
    ],
    goalDrift: "No major drift; scope stayed on MCP exposure only.",
    nextWeekSuggestions: [
      {
        detail: "Keep deterministic language explicit in UI and tool descriptions.",
      },
    ],
    lifePossibilityNotes: "Current note is operational, not a deep AI reflection.",
    createdAt: "2026-06-21T08:00:00.000Z",
    updatedAt: "2026-06-21T08:00:00.000Z",
    emotionPattern: {
      id: "emotion-pattern-1",
      userId: "user-1",
      weeklyReviewId: "weekly-review-1",
      periodStart: "2026-06-15T00:00:00.000Z",
      periodEnd: "2026-06-21T23:59:59.999Z",
      dominantEmotions: ["focused", "relieved"],
      triggers: ["scope clarity", "stubbed API verification"],
      patterns: [
        {
          detail: "Stress dropped after API contract reuse became clear.",
        },
      ],
      decisionRisk: "Low current risk; main constraint remains deterministic coverage only.",
      createdAt: "2026-06-21T08:00:00.000Z",
      updatedAt: "2026-06-21T08:00:00.000Z",
    },
    citations: [
      {
        id: "citation-1",
        title: "Weekly review source citation",
        url: "https://example.com/weekly-review/citation-1",
        sourceType: "daily_entry",
      },
    ],
  };

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    response.setHeader("Content-Type", "application/json");

    if (url.pathname === "/api/external-sources/search" && request.method === "POST") {
      const body = await readJsonBody(request);
      assert.deepEqual(body, {
        query: "AI 应用工程师 岗位要求 广州 job_board",
        category: "ai_role",
        lifeDecisionId: "decision-1",
        limit: 2,
      });

      response.statusCode = 201;
      response.end(
        createJsonResponse(
          {
            query: "AI 应用工程师 岗位要求 广州 job_board",
            category: "ai_role",
            searchMode: "fake",
            summary:
              "fake provider returned 2 deterministic source snippets for local MCP smoke.",
            items: [
              {
                title: "AI 应用工程师岗位要求样例 1",
                sourceSite: "Fake Search Provider",
                url: "https://example.com/mcp-search/1",
                summary: "用于验证 MCP 外部搜索保存链路。",
              },
              {
                title: "AI 应用工程师岗位要求样例 2",
                sourceSite: "Fake Search Provider",
                url: "https://example.com/mcp-search/2",
                summary: "用于验证 MCP 外部搜索保存链路的第二条来源。",
              },
            ],
            savedItems: [
              {
                id: "external-source-1",
                userId: "user-1",
                lifeDecisionId: "decision-1",
                title: "AI 应用工程师岗位要求样例 1",
                sourceSite: "Fake Search Provider",
                url: "https://example.com/mcp-search/1",
                publishedAt: null,
                fetchedAt: null,
                summary: "用于验证 MCP 外部搜索保存链路。",
                relationToDecision:
                  "仅用于本地自动化验收，不代表真实外部研究结论。",
                createdAt: "2026-06-18T12:00:00.000Z",
                updatedAt: "2026-06-18T12:00:00.000Z",
              },
              {
                id: "external-source-2",
                userId: "user-1",
                lifeDecisionId: "decision-1",
                title: "AI 应用工程师岗位要求样例 2",
                sourceSite: "Fake Search Provider",
                url: "https://example.com/mcp-search/2",
                publishedAt: null,
                fetchedAt: null,
                summary: "用于验证 MCP 外部搜索保存链路的第二条来源。",
                relationToDecision:
                  "仅用于本地自动化验收，不代表真实外部研究结论。",
                createdAt: "2026-06-18T12:01:00.000Z",
                updatedAt: "2026-06-18T12:01:00.000Z",
              },
            ],
            sourceSnapshot: {
              searchedAt: "2026-06-18T12:00:00.000Z",
              provider: "fake",
              requestedLimit: 2,
              returnedResults: 2,
              savedResults: 2,
              lifeDecisionId: "decision-1",
            },
          },
          "req-external-source-search",
        ),
      );
      return;
    }

    if (url.pathname === "/api/decision-evidence" && request.method === "POST") {
      const body = await readJsonBody(request);
      assert.deepEqual(body, {
        decisionId: "decision-1",
        pathId: "path-1",
        evidenceType: "support",
        content: "MCP can create bounded decision evidence.",
        weight: 0.7,
        externalSourceId: "external-source-1",
      });

      response.statusCode = 201;
      response.end(
        createJsonResponse(
          {
            id: "decision-evidence-1",
            userId: "user-1",
            decisionId: "decision-1",
            pathId: "path-1",
            sourceCitationId: "source-citation-1",
            evidenceType: "support",
            content: "MCP can create bounded decision evidence.",
            weight: 0.7,
            createdAt: "2026-06-18T07:10:00.000Z",
            updatedAt: "2026-06-18T07:10:00.000Z",
          },
          "req-create-decision-evidence",
        ),
      );
      return;
    }

    if (url.pathname === "/api/ability-evidence" && request.method === "POST") {
      const body = await readJsonBody(request);
      assert.deepEqual(body, {
        abilityNodeId: "ability-root",
        content: "MCP can create a bounded ability evidence candidate.",
        impact: "positive",
        difficultyScore: 4,
        independenceScore: 3,
        impactScore: 5,
        feedbackScore: 1,
        recurrenceCount: 2,
        status: "candidate",
      });

      response.statusCode = 201;
      response.end(
        createJsonResponse(
          {
            id: "ability-evidence-candidate-1",
            userId: "user-1",
            abilityNodeId: "ability-root",
            sourceCitationId: null,
            content: "MCP can create a bounded ability evidence candidate.",
            impact: "positive",
            difficultyScore: 4,
            independenceScore: 3,
            impactScore: 5,
            feedbackScore: 1,
            recurrenceCount: 2,
            status: "candidate",
            createdAt: "2026-06-18T08:30:00.000Z",
            updatedAt: "2026-06-18T08:30:00.000Z",
          },
          "req-create-ability-evidence",
        ),
      );
      return;
    }

    if (url.pathname === "/api/weekly-reviews/generate" && request.method === "POST") {
      const body = await readJsonBody(request);
      assert.deepEqual(body, {
        periodStart: "2026-06-15T00:00:00.000Z",
        periodEnd: "2026-06-21T23:59:59.999Z",
        lifeDecisionId: "decision-1",
      });

      response.statusCode = 201;
      response.end(
        createJsonResponse(
          {
            weeklyReview: weeklyReviewDetail,
            generationMode: "deterministic",
            sourceSnapshot: {
              dailyEntriesRead: 3,
              structuredReportsRead: 2,
              metricRatingsRead: 4,
              confirmedMemoriesRead: 1,
              decisionEvidenceRead: 2,
            },
          },
          "req-weekly-generate",
        ),
      );
      return;
    }

    if (url.pathname === "/api/weekly-reviews/latest" && request.method === "GET") {
      assert.equal(url.searchParams.get("lifeDecisionId"), "decision-1");
      response.statusCode = 200;
      response.end(createJsonResponse(weeklyReviewDetail, "req-weekly-latest"));
      return;
    }

    if (url.pathname === "/api/weekly-reviews" && request.method === "GET") {
      assert.equal(url.searchParams.get("periodStart"), "2026-06-15T00:00:00.000Z");
      assert.equal(url.searchParams.get("periodEnd"), "2026-06-21T23:59:59.999Z");
      assert.equal(url.searchParams.get("lifeDecisionId"), "decision-1");
      response.statusCode = 200;
      response.end(createJsonResponse(weeklyReviewDetail, "req-weekly-by-period"));
      return;
    }

    if (url.pathname === "/api/memories" && request.method === "POST") {
      const body = await readJsonBody(request);
      assert.deepEqual(body, {
        memoryType: "goal",
        content: "MCP can create a bounded memory candidate.",
        status: "candidate",
        confidence: 0.82,
        expiresAt: "2026-07-02T00:00:00.000Z",
      });

      response.statusCode = 201;
      response.end(
        createJsonResponse(
          {
            id: "memory-candidate-1",
            userId: "user-1",
            memoryType: "goal",
            content: "MCP can create a bounded memory candidate.",
            sourceCitationId: null,
            status: "candidate",
            confidence: 0.82,
            isMomentaryThought: false,
            expiresAt: "2026-07-02T00:00:00.000Z",
            createdAt: "2026-06-18T10:10:00.000Z",
            updatedAt: "2026-06-18T10:10:00.000Z",
          },
          "req-create-memory",
        ),
      );
      return;
    }

    if (url.pathname === "/api/memories") {
      response.statusCode = 200;
      response.end(
        createJsonResponse(
          {
            items: [
              {
                id: "memory-1",
                userId: "user-1",
                memoryType: "goal",
                content: "Ship the first MCP release",
                sourceCitationId: "citation-1",
                status: "confirmed",
                confidence: 0.92,
                isMomentaryThought: false,
                expiresAt: null,
                createdAt: "2026-06-18T10:00:00.000Z",
                updatedAt: "2026-06-18T10:00:00.000Z",
              },
            ],
            pagination: {
              limit: 20,
              offset: 0,
              total: 1,
            },
          },
          "req-memories",
        ),
      );
      return;
    }

    if (url.pathname === "/api/daily-entries") {
      response.statusCode = 200;
      response.end(
        createJsonResponse(
          {
            items: [
              {
                id: "daily-1",
                userId: "user-1",
                source: "web",
                rawContent: "Worked on MCP handlers.",
                recordedAt: "2026-06-18T09:00:00.000Z",
                createdAt: "2026-06-18T09:00:00.000Z",
                updatedAt: "2026-06-18T09:00:00.000Z",
              },
            ],
            pagination: {
              limit: 20,
              offset: 0,
              total: 1,
            },
          },
          "req-daily-list",
        ),
      );
      return;
    }

    if (url.pathname === "/api/daily-entries/daily-1") {
      response.statusCode = 200;
      response.end(
        createJsonResponse(
          {
            id: "daily-1",
            userId: "user-1",
            source: "web",
            rawContent: "Worked on MCP handlers.",
            recordedAt: "2026-06-18T09:00:00.000Z",
            createdAt: "2026-06-18T09:00:00.000Z",
            updatedAt: "2026-06-18T09:00:00.000Z",
            metrics: [],
            events: [],
            structuredReport: {
              id: "report-1",
              dailyEntryId: "daily-1",
              facts: [{ detail: "Implemented read-only MCP handlers." }],
              emotions: [],
              workItems: [],
              feedback: [],
              growthEvidence: [],
              drainSources: [],
              nextActions: [],
              decisionImpact: [],
              createdAt: "2026-06-18T09:05:00.000Z",
              updatedAt: "2026-06-18T09:05:00.000Z",
            },
          },
          "req-daily-detail",
        ),
      );
      return;
    }

    if (url.pathname === "/api/ability-nodes") {
      response.statusCode = 200;
      response.end(
        createJsonResponse(
          {
            items: [
              {
                id: "ability-root",
                userId: "user-1",
                parentId: null,
                name: "Engineering",
                description: "Core engineering ability",
                level: 1,
                origin: "system",
                createdAt: "2026-06-18T08:00:00.000Z",
                updatedAt: "2026-06-18T08:00:00.000Z",
                evidenceItems: [
                  {
                    id: "evidence-1",
                    userId: "user-1",
                    abilityNodeId: "ability-root",
                    sourceCitationId: null,
                    content: "Built the MCP package.",
                    impact: "positive",
                    difficultyScore: 4,
                    independenceScore: 4,
                    impactScore: 4,
                    feedbackScore: 4,
                    recurrenceCount: 1,
                    status: "confirmed",
                    createdAt: "2026-06-18T08:10:00.000Z",
                    updatedAt: "2026-06-18T08:10:00.000Z",
                  },
                ],
                children: [
                  {
                    id: "ability-child",
                    userId: "user-1",
                    parentId: "ability-root",
                    name: "TypeScript",
                    description: "Typed backend integration",
                    level: 2,
                    origin: "system",
                    createdAt: "2026-06-18T08:20:00.000Z",
                    updatedAt: "2026-06-18T08:20:00.000Z",
                    evidenceItems: [],
                    children: [],
                  },
                ],
              },
            ],
          },
          "req-ability",
        ),
      );
      return;
    }

    if (url.pathname === "/api/life-decisions") {
      response.statusCode = 200;
      response.end(
        createJsonResponse(
          [
            {
              id: "decision-1",
              userId: "user-1",
              title: "Stay focused on MCP scope",
              description: "First batch only",
              deadline: null,
              status: "active",
              finalDecision: null,
              createdAt: "2026-06-18T07:00:00.000Z",
              updatedAt: "2026-06-18T07:00:00.000Z",
            },
          ],
          "req-decision-list",
        ),
      );
      return;
    }

    if (url.pathname === "/api/life-decisions/decision-1") {
      response.statusCode = 200;
      response.end(
        createJsonResponse(
          {
            id: "decision-1",
            userId: "user-1",
            title: "Stay focused on MCP scope",
            description: "First batch only",
            deadline: null,
            status: "active",
            finalDecision: null,
            createdAt: "2026-06-18T07:00:00.000Z",
            updatedAt: "2026-06-18T07:00:00.000Z",
            paths: [
              {
                id: "path-1",
                decisionId: "decision-1",
                title: "Ship read-only tools",
                description: "Safer first batch",
                benefits: ["Lower risk"],
                risks: ["Less scope"],
                currentScore: 8,
                createdAt: "2026-06-18T07:05:00.000Z",
                updatedAt: "2026-06-18T07:05:00.000Z",
                evidenceItems: [],
              },
            ],
            evidenceItems: [],
            externalSources: [],
          },
          "req-decision-detail",
        ),
      );
      return;
    }

    response.statusCode = 404;
    response.end(
      JSON.stringify({
        data: null,
        error: {
          code: "NotFound",
          message: `Unhandled path ${url.pathname}`,
        },
        requestId: "req-404",
      }),
    );
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to bind stub API server.");
  }

  return {
    apiBaseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
  };
}

async function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  return rawBody ? JSON.parse(rawBody) : null;
}

export async function runSmokeTest(): Promise<void> {
  const stubApi = await startStubApiServer();

  try {
    const server = createDigitalSelfMcpServerWithApiHandlers({
      apiBaseUrl: stubApi.apiBaseUrl,
    });

    const toolNames = server.listTools().map((tool) => tool.name);
    assert.equal(toolNames.length, 13);
    assert.equal(toolNames.includes("generate_weekly_review"), true);
    assert.equal(toolNames.includes("get_latest_weekly_review"), true);
    assert.equal(toolNames.includes("get_weekly_review_by_period"), true);

    const memoriesResult = await server.executeTool("read_memories", {
      userId: "compat-user",
    });
    assert.equal(memoriesResult.isError, undefined);
    assert.deepEqual(memoriesResult.structuredContent, {
      items: [
        {
          memoryId: "memory-1",
          memoryType: "goal",
          content: "Ship the first MCP release",
          status: "confirmed",
          confidence: 0.92,
          sourceCitations: [
            {
              sourceId: "citation-1",
            },
          ],
        },
      ],
    });

    const createMemoryCandidateResult = await server.executeTool("create_memory_candidate", {
      userId: "compat-user",
      memoryType: "goal",
      content: "MCP can create a bounded memory candidate.",
      sourceCitations: [],
      reason: "smoke",
      confidence: 0.82,
      expiresAt: "2026-07-02T00:00:00.000Z",
    });
    assert.equal(createMemoryCandidateResult.isError, undefined);
    assert.deepEqual(createMemoryCandidateResult.structuredContent, {
      candidateId: "memory-candidate-1",
      status: "candidate",
    });

    const unsupportedMemoryCitationResult = await server.executeTool("create_memory_candidate", {
      userId: "compat-user",
      memoryType: "goal",
      content: "MCP should reject citations until citation mapping is implemented.",
      sourceCitations: [
        {
          sourceType: "daily_entry",
          sourceId: "daily-1",
          quote: "source quote",
        },
      ],
      reason: "smoke",
    });
    assert.equal(unsupportedMemoryCitationResult.isError, true);
    assert.equal(
      (unsupportedMemoryCitationResult.structuredContent as { code?: string }).code,
      "UNSUPPORTED_SOURCE_CITATIONS",
    );

    const dailyEntriesResult = await server.executeTool("list_daily_entries", {
      userId: "compat-user",
      includeStructuredSummary: true,
    });
    assert.equal(dailyEntriesResult.isError, undefined);
    assert.deepEqual(dailyEntriesResult.structuredContent, {
      items: [
        {
          dailyEntryId: "daily-1",
          source: "web",
          rawContent: "Worked on MCP handlers.",
          structuredSummary: "facts: Implemented read-only MCP handlers.",
          createdAt: "2026-06-18T09:00:00.000Z",
        },
      ],
    });

    const abilityNodesResult = await server.executeTool("list_ability_nodes", {
      userId: "compat-user",
      rootNodeId: "ability-root",
    });
    assert.equal(abilityNodesResult.isError, undefined);
    assert.deepEqual(abilityNodesResult.structuredContent, {
      items: [
        {
          abilityNodeId: "ability-root",
          name: "Engineering",
          description: "Core engineering ability",
          level: 1,
          confirmedEvidenceCount: 1,
        },
        {
          abilityNodeId: "ability-child",
          name: "TypeScript",
          parentId: "ability-root",
          description: "Typed backend integration",
          level: 2,
          confirmedEvidenceCount: 0,
        },
      ],
    });

    const createAbilityEvidenceResult = await server.executeTool(
      "create_ability_evidence_candidate",
      {
        abilityNodeId: "ability-root",
        content: "MCP can create a bounded ability evidence candidate.",
        sourceCitations: [],
        impact: "positive",
        scores: {
          difficultyScore: 4,
          independenceScore: 3,
          impactScore: 5,
          feedbackScore: 1,
          recurrenceCount: 2,
        },
      },
    );
    assert.equal(createAbilityEvidenceResult.isError, undefined);
    assert.deepEqual(createAbilityEvidenceResult.structuredContent, {
      candidateId: "ability-evidence-candidate-1",
      status: "candidate",
    });

    const unsupportedAbilityCitationResult = await server.executeTool(
      "create_ability_evidence_candidate",
      {
        abilityNodeId: "ability-root",
        content: "MCP should reject citations until citation mapping is implemented.",
        sourceCitations: [
          {
            sourceType: "daily_entry",
            sourceId: "daily-1",
            quote: "source quote",
          },
        ],
        impact: "positive",
        scores: {
          difficultyScore: 4,
          independenceScore: 3,
          impactScore: 5,
          feedbackScore: 1,
          recurrenceCount: 2,
        },
      },
    );
    assert.equal(unsupportedAbilityCitationResult.isError, true);
    assert.equal(
      (unsupportedAbilityCitationResult.structuredContent as { code?: string }).code,
      "UNSUPPORTED_SOURCE_CITATIONS",
    );

    const decisionResult = await server.executeTool("get_life_decision", {
      includePaths: true,
      includeMetricRatings: true,
    });
    assert.equal(decisionResult.isError, undefined);
    assert.deepEqual(decisionResult.structuredContent, {
      lifeDecision: {
        lifeDecisionId: "decision-1",
        title: "Stay focused on MCP scope",
        description: "First batch only",
        status: "active",
        paths: [
          {
            pathId: "path-1",
            title: "Ship read-only tools",
            description: "Safer first batch",
          },
        ],
        metricRatings: [],
      },
    });

    const createDecisionEvidenceResult = await server.executeTool("create_decision_evidence", {
      decisionId: "decision-1",
      pathId: "path-1",
      evidenceType: "support",
      content: "MCP can create bounded decision evidence.",
      weight: 0.7,
      externalSourceId: "external-source-1",
    });
    assert.equal(createDecisionEvidenceResult.isError, undefined);
    assert.deepEqual(createDecisionEvidenceResult.structuredContent, {
      decisionEvidenceId: "decision-evidence-1",
      sourceCitationId: "source-citation-1",
    });

    const unsupportedSourceCitationResult = await server.executeTool("create_decision_evidence", {
      decisionId: "decision-1",
      pathId: "path-1",
      evidenceType: "support",
      content: "MCP should reject free-form citations until MCP maps them explicitly.",
      sourceCitations: [
        {
          sourceType: "external_source",
          sourceId: "external-1",
          quote: "source quote",
        },
      ],
    });
    assert.equal(unsupportedSourceCitationResult.isError, true);
    assert.equal(
      (unsupportedSourceCitationResult.structuredContent as { code?: string }).code,
      "UNSUPPORTED_SOURCE_CITATIONS",
    );

    const externalSearchResult = await server.executeTool("search_external_sources", {
      query: "AI 应用工程师 岗位要求",
      topic: "job_requirements",
      region: "广州",
      maxResults: 2,
      lifeDecisionId: "decision-1",
      preferredSourceTypes: ["job_board"],
    });
    assert.equal(externalSearchResult.isError, undefined);
    assert.deepEqual(externalSearchResult.structuredContent, {
      results: [
        {
          title: "AI 应用工程师岗位要求样例 1",
          sourceSite: "Fake Search Provider",
          url: "https://example.com/mcp-search/1",
          summary: "用于验证 MCP 外部搜索保存链路。",
        },
        {
          title: "AI 应用工程师岗位要求样例 2",
          sourceSite: "Fake Search Provider",
          url: "https://example.com/mcp-search/2",
          summary: "用于验证 MCP 外部搜索保存链路的第二条来源。",
        },
      ],
      summary: "fake provider returned 2 deterministic source snippets for local MCP smoke.",
      searchMode: "fake",
      sourceSnapshot: {
        searchedAt: "2026-06-18T12:00:00.000Z",
        provider: "fake",
        requestedLimit: 2,
        returnedResults: 2,
        savedResults: 2,
        lifeDecisionId: "decision-1",
      },
      savedItems: [
        {
          externalSourceId: "external-source-1",
          title: "AI 应用工程师岗位要求样例 1",
          sourceSite: "Fake Search Provider",
          url: "https://example.com/mcp-search/1",
          summary: "用于验证 MCP 外部搜索保存链路。",
          relationToDecision: "仅用于本地自动化验收，不代表真实外部研究结论。",
        },
        {
          externalSourceId: "external-source-2",
          title: "AI 应用工程师岗位要求样例 2",
          sourceSite: "Fake Search Provider",
          url: "https://example.com/mcp-search/2",
          summary: "用于验证 MCP 外部搜索保存链路的第二条来源。",
          relationToDecision: "仅用于本地自动化验收，不代表真实外部研究结论。",
        },
      ],
    });
    assert.match(
      externalSearchResult.content[0]?.type === "text"
        ? externalSearchResult.content[0].text
        : "",
      /best-effort source links and snippets/,
    );

    const generateWeeklyReviewResult = await server.executeTool("generate_weekly_review", {
      userId: "compat-user",
      periodStart: "2026-06-15T00:00:00.000Z",
      periodEnd: "2026-06-21T23:59:59.999Z",
      lifeDecisionId: "decision-1",
    });
    assert.equal(generateWeeklyReviewResult.isError, undefined);
    assert.deepEqual(generateWeeklyReviewResult.structuredContent, {
      weeklyReview: {
        weeklyReviewId: "weekly-review-1",
        lifeDecisionId: "decision-1",
        periodStart: "2026-06-15T00:00:00.000Z",
        periodEnd: "2026-06-21T23:59:59.999Z",
        progressSummary: "Completed the bounded MCP weekly review integration.",
        abilityChanges: [
          {
            title: "Integration",
            detail: "Connected MCP handlers to the weekly review REST endpoints.",
            citationIds: ["citation-1"],
          },
        ],
        emotionPatterns: [
          {
            detail: "Calmer progress once the schema and handler boundaries were fixed.",
          },
        ],
        goalDrift: "No major drift; scope stayed on MCP exposure only.",
        nextWeekSuggestions: [
          {
            detail: "Keep deterministic language explicit in UI and tool descriptions.",
          },
        ],
        lifePossibilityNotes: "Current note is operational, not a deep AI reflection.",
        createdAt: "2026-06-21T08:00:00.000Z",
        updatedAt: "2026-06-21T08:00:00.000Z",
        emotionPattern: {
          emotionPatternId: "emotion-pattern-1",
          weeklyReviewId: "weekly-review-1",
          periodStart: "2026-06-15T00:00:00.000Z",
          periodEnd: "2026-06-21T23:59:59.999Z",
          dominantEmotions: ["focused", "relieved"],
          triggers: ["scope clarity", "stubbed API verification"],
          patterns: [
            {
              detail: "Stress dropped after API contract reuse became clear.",
            },
          ],
          decisionRisk: "Low current risk; main constraint remains deterministic coverage only.",
          createdAt: "2026-06-21T08:00:00.000Z",
          updatedAt: "2026-06-21T08:00:00.000Z",
        },
        citations: [
          {
            citationId: "citation-1",
            title: "Weekly review source citation",
            url: "https://example.com/weekly-review/citation-1",
            sourceType: "daily_entry",
          },
        ],
      },
      generationMode: "deterministic",
      sourceSnapshot: {
        dailyEntriesRead: 3,
        structuredReportsRead: 2,
        metricRatingsRead: 4,
        confirmedMemoriesRead: 1,
        decisionEvidenceRead: 2,
      },
    });

    const latestWeeklyReviewResult = await server.executeTool("get_latest_weekly_review", {
      userId: "compat-user",
      lifeDecisionId: "decision-1",
    });
    assert.equal(latestWeeklyReviewResult.isError, undefined);
    assert.deepEqual(latestWeeklyReviewResult.structuredContent, {
      weeklyReview: (generateWeeklyReviewResult.structuredContent as { weeklyReview: unknown })
        .weeklyReview,
    });

    const weeklyReviewByPeriodResult = await server.executeTool(
      "get_weekly_review_by_period",
      {
        userId: "compat-user",
        periodStart: "2026-06-15T00:00:00.000Z",
        periodEnd: "2026-06-21T23:59:59.999Z",
        lifeDecisionId: "decision-1",
      },
    );
    assert.equal(weeklyReviewByPeriodResult.isError, undefined);
    assert.deepEqual(weeklyReviewByPeriodResult.structuredContent, {
      weeklyReview: (generateWeeklyReviewResult.structuredContent as { weeklyReview: unknown })
        .weeklyReview,
    });
  } finally {
    await stubApi.close();
  }

  const unavailableServer = createDigitalSelfMcpServerWithApiHandlers({
    apiBaseUrl: "http://127.0.0.1:1",
  });

  const unavailableResult = await unavailableServer.executeTool("read_memories", {
    userId: "compat-user",
  });
  assert.equal(unavailableResult.isError, true);
  assert.equal(
    (unavailableResult.structuredContent as { code?: string }).code,
    "API_REQUEST_FAILED",
  );

  const notImplementedResult = await unavailableServer.executeTool(
    "send_feishu_message",
    {
      targetId: "target-1",
      targetType: "user",
      message: "placeholder",
    },
  );
  assert.equal(notImplementedResult.isError, true);
  assert.equal(
    (notImplementedResult.structuredContent as { code?: string }).code,
    "NOT_IMPLEMENTED",
  );
}

if (require.main === module) {
  void runSmokeTest().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.stack ?? error.message : String(error);

    process.stderr.write(`[digital-self-mcp] smoke failed: ${message}\n`);
    process.exitCode = 1;
  });
}
