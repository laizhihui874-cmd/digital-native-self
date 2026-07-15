#!/usr/bin/env node

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";
assertIsolatedVerificationRuntime();

import assert from "node:assert/strict";

const DEFAULT_BASE_URL = "http://localhost:3001";
const REQUEST_TIMEOUT_MS = 10_000;

const baseUrl = normalizeBaseUrl(
  process.env.MEMORY_CANDIDATES_API_BASE_URL ??
    process.env.STRUCTURED_REPORT_API_BASE_URL ??
    process.env.API_BASE_URL ??
    DEFAULT_BASE_URL,
);
const now = new Date().toISOString();
const createdRawContent = `verify-memory-candidates ${now}`;

const reportPayload = {
  facts: [
    { title: "关键事实", detail: `完成结构化日报到候选记忆 API 的最小闭环开发 ${now}` },
    { title: "补充说明", detail: "把 DailyEntry、StructuredDailyReport 和 Memory 串成了真实链路" },
  ],
  emotions: [{ title: "情绪", detail: "对回归结果保持谨慎" }],
  workItems: [{ title: "实施", detail: "整理 memory candidates 的验收脚本" }],
  feedback: [{ title: "反馈", detail: "先验证候选记忆仍然需要用户确认" }],
  growthEvidence: [
    { title: "成长证据", detail: `独立完成结构化日报到候选记忆的接口串联 ${now}` },
  ],
  drainSources: [{ title: "消耗来源", detail: "手工核对去重和幂等分支比较费时" }],
  nextActions: [{ title: "后续动作", detail: `明天继续补充候选记忆接口的幂等回归 ${now}` }],
  decisionImpact: [
    { title: "决策影响", detail: `确认 AI 提取结果先作为候选记忆等待用户确认 ${now}` },
  ],
};

try {
  logStep(`Using base URL: ${baseUrl}`);

  const createdEntryResponse = await requestJson("/api/daily-entries", {
    method: "POST",
    body: {
      rawContent: createdRawContent,
    },
  });
  assertOkStatus(createdEntryResponse, "POST /api/daily-entries");
  const createdEntry = expectSuccessEnvelope(createdEntryResponse.payload, "POST /api/daily-entries");

  const createReportResponse = await requestJson("/api/structured-daily-reports", {
    method: "POST",
    body: {
      dailyEntryId: createdEntry.id,
      ...reportPayload,
    },
  });
  assertOkStatus(createReportResponse, "POST /api/structured-daily-reports");
  const createdReport = expectSuccessEnvelope(
    createReportResponse.payload,
    "POST /api/structured-daily-reports",
  );

  const firstCandidateResponse = await requestJson(
    `/api/structured-daily-reports/${createdEntry.id}/memory-candidates`,
    {
      method: "POST",
    },
  );
  assertOkStatus(
    firstCandidateResponse,
    `POST /api/structured-daily-reports/${createdEntry.id}/memory-candidates`,
  );
  const firstCandidatePayload = expectSuccessEnvelope(
    firstCandidateResponse.payload,
    `POST /api/structured-daily-reports/${createdEntry.id}/memory-candidates`,
  );

  assert.equal(firstCandidatePayload.source.dailyEntryId, createdEntry.id);
  assert.equal(firstCandidatePayload.source.structuredReportId, createdReport.id);
  assert.ok(Array.isArray(firstCandidatePayload.created), "created should be an array");
  assert.ok(firstCandidatePayload.created.length >= 4, "first extraction should create at least 4 candidates");
  assert.equal(typeof firstCandidatePayload.skippedCount, "number", "skippedCount should be a number");

  const createdTypes = new Set(firstCandidatePayload.created.map((item) => item.memoryType));
  for (const requiredType of ["ability", "goal", "decision", "event"]) {
    assert.ok(createdTypes.has(requiredType), `created candidates should include memoryType=${requiredType}`);
  }

  for (const createdMemory of firstCandidatePayload.created) {
    assert.equal(createdMemory.status, "candidate", "created memory status should stay candidate");
    assert.equal(typeof createdMemory.id, "string", "created memory id should be a string");
    assert.equal(typeof createdMemory.sourceCitationId, "string", "created memory should carry sourceCitationId");
  }
  logPass("First memory-candidates request created candidate memories with expected types");

  const listMemoriesResponse = await requestJson("/api/memories?status=candidate&limit=100&offset=0");
  assertOkStatus(listMemoriesResponse, "GET /api/memories?status=candidate&limit=100&offset=0");
  const listedMemoriesPayload = expectSuccessEnvelope(
    listMemoriesResponse.payload,
    "GET /api/memories?status=candidate&limit=100&offset=0",
  );

  assert.ok(Array.isArray(listedMemoriesPayload.items), "list memories response should include items");

  for (const createdMemory of firstCandidatePayload.created) {
    const matchedById = listedMemoriesPayload.items.filter((item) => item.id === createdMemory.id);
    assert.equal(matchedById.length, 1, `candidate list should contain created memory id=${createdMemory.id}`);

    const matchedByContent = listedMemoriesPayload.items.filter(
      (item) => item.content === createdMemory.content && item.status === "candidate",
    );
    assert.equal(
      matchedByContent.length,
      1,
      `candidate list should not contain duplicate content for "${createdMemory.content}"`,
    );
  }
  logPass("Candidate memory list contains the created items without duplicate content");

  const secondCandidateResponse = await requestJson(
    `/api/structured-daily-reports/${createdEntry.id}/memory-candidates`,
    {
      method: "POST",
    },
  );
  assertOkStatus(
    secondCandidateResponse,
    `POST /api/structured-daily-reports/${createdEntry.id}/memory-candidates second call`,
  );
  const secondCandidatePayload = expectSuccessEnvelope(
    secondCandidateResponse.payload,
    `POST /api/structured-daily-reports/${createdEntry.id}/memory-candidates second call`,
  );

  assert.equal(
    secondCandidatePayload.source.dailyEntryId,
    createdEntry.id,
    "second call should return the same dailyEntryId",
  );
  assert.equal(
    secondCandidatePayload.source.structuredReportId,
    createdReport.id,
    "second call should return the same structuredReportId",
  );
  assert.deepEqual(secondCandidatePayload.created, [], "second call should not create duplicate memories");
  assert.ok(
    secondCandidatePayload.skippedCount >= firstCandidatePayload.created.length,
    "second call skippedCount should cover already-created candidates",
  );
  logPass("Second memory-candidates request stayed idempotent");

  logPass("Memory candidates API verification completed");
} catch (error) {
  logFail(formatError(error));
  process.exit(1);
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

async function requestJson(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const rawText = await response.text();
  const payload = rawText ? safeJsonParse(rawText) : null;

  return {
    status: response.status,
    statusText: response.statusText,
    payload,
    rawText,
  };
}

function assertOkStatus(response, label) {
  if (response.status >= 200 && response.status < 300) {
    return;
  }

  throw new Error(
    `${label} failed with ${response.status} ${response.statusText}: ${response.rawText || "<empty body>"}`,
  );
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function expectSuccessEnvelope(payload, label) {
  assert.ok(payload && typeof payload === "object", `${label} should return a JSON object`);
  assert.ok("data" in payload, `${label} should include data`);
  assert.ok("error" in payload, `${label} should include error`);
  assert.ok("requestId" in payload, `${label} should include requestId`);
  assert.equal(payload.error, null, `${label} should have error=null`);
  assert.equal(typeof payload.requestId, "string", `${label} requestId should be a string`);
  assert.notEqual(payload.requestId.length, 0, `${label} requestId should not be empty`);

  return payload.data;
}

function formatError(error) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

function logStep(message) {
  console.log(`[verify:memory-candidates] ${message}`);
}

function logPass(message) {
  console.log(`[verify:memory-candidates] PASS ${message}`);
}

function logFail(message) {
  console.error(`[verify:memory-candidates] FAIL ${message}`);
}
