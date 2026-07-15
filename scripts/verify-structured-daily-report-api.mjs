#!/usr/bin/env node

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";
assertIsolatedVerificationRuntime();

import assert from "node:assert/strict";

const DEFAULT_BASE_URL = "http://localhost:3001";
const REQUEST_TIMEOUT_MS = 10_000;

const baseUrl = normalizeBaseUrl(
  process.env.STRUCTURED_REPORT_API_BASE_URL ?? process.env.API_BASE_URL ?? DEFAULT_BASE_URL,
);
const now = new Date().toISOString();
const createdRawContent = `verify-structured-daily-report ${now}`;

const reportPayload = {
  facts: [
    { title: "关键事实", detail: `完成 API 验收链路检查 ${now}` },
    { detail: "同步补充 StructuredDailyReport 最小字段覆盖" },
  ],
  emotions: [{ title: "情绪", detail: "对当前进度保持谨慎乐观" }],
  workItems: [
    { title: "实施", detail: "编写最小 API 验收脚本" },
    { detail: "更新脚本说明和验收规格" },
  ],
  feedback: [{ title: "反馈", detail: "接口层先验证 contract，再交给主 agent 验收" }],
  growthEvidence: [
    { title: "成长证据", detail: "能够把 DailyEntry 与 StructuredDailyReport 串成真实链路" },
  ],
  drainSources: [{ title: "消耗来源", detail: "手工回归接口容易遗漏冲突分支" }],
  nextActions: [{ title: "后续动作", detail: "保留脚本用于本地回归和主 agent 验收" }],
  decisionImpact: [{ title: "决策影响", detail: "确认日报详情接口已返回同一 structuredReport" }],
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

  assert.equal(typeof createdEntry.id, "string", "created entry id should be a string");
  assert.equal(createdEntry.rawContent, createdRawContent, "created entry rawContent should match request payload");
  logPass(`POST /api/daily-entries created id=${createdEntry.id}`);

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

  assertStructuredDailyReport(createdReport, createdEntry.id, "POST /api/structured-daily-reports");
  assertStructuredFieldsMatch(createdReport, reportPayload, "POST /api/structured-daily-reports");
  logPass(`POST /api/structured-daily-reports created id=${createdReport.id}`);

  const fetchedReportResponse = await requestJson(`/api/structured-daily-reports/${createdEntry.id}`);
  assertOkStatus(fetchedReportResponse, `GET /api/structured-daily-reports/${createdEntry.id}`);
  const fetchedReport = expectSuccessEnvelope(
    fetchedReportResponse.payload,
    `GET /api/structured-daily-reports/${createdEntry.id}`,
  );

  assertStructuredDailyReport(
    fetchedReport,
    createdEntry.id,
    `GET /api/structured-daily-reports/${createdEntry.id}`,
  );
  assertStructuredFieldsMatch(
    fetchedReport,
    reportPayload,
    `GET /api/structured-daily-reports/${createdEntry.id}`,
  );
  assert.equal(fetchedReport.id, createdReport.id, "fetched report id should match created report id");
  logPass("GET /api/structured-daily-reports/:dailyEntryId returned the created report");

  const fetchedEntryResponse = await requestJson(`/api/daily-entries/${createdEntry.id}`);
  assertOkStatus(fetchedEntryResponse, `GET /api/daily-entries/${createdEntry.id}`);
  const fetchedEntry = expectSuccessEnvelope(
    fetchedEntryResponse.payload,
    `GET /api/daily-entries/${createdEntry.id}`,
  );

  assert.equal(fetchedEntry.id, createdEntry.id, "fetched daily entry id should match created entry id");
  assert.ok(fetchedEntry.structuredReport, "daily entry detail should include structuredReport");
  assertStructuredDailyReport(
    fetchedEntry.structuredReport,
    createdEntry.id,
    `GET /api/daily-entries/${createdEntry.id}`,
  );
  assert.equal(
    fetchedEntry.structuredReport.id,
    createdReport.id,
    "daily entry detail structuredReport.id should match created report id",
  );
  assertStructuredFieldsMatch(
    fetchedEntry.structuredReport,
    reportPayload,
    `GET /api/daily-entries/${createdEntry.id}`,
  );
  logPass("GET /api/daily-entries/:id returned the same structuredReport");

  const conflictResponse = await requestJson("/api/structured-daily-reports", {
    method: "POST",
    body: {
      dailyEntryId: createdEntry.id,
      ...reportPayload,
    },
  });

  assert.equal(
    conflictResponse.status,
    409,
    `second POST /api/structured-daily-reports should return 409, got ${conflictResponse.status}`,
  );
  const conflictPayload = expectErrorEnvelope(
    conflictResponse.payload,
    "POST /api/structured-daily-reports duplicate",
  );
  assert.match(
    conflictPayload.error.message,
    /already exists/i,
    "duplicate POST error message should mention existing structured report",
  );
  logPass("POST /api/structured-daily-reports duplicate request returned 409");

  logPass("StructuredDailyReport API verification completed");
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

function expectErrorEnvelope(payload, label) {
  assert.ok(payload && typeof payload === "object", `${label} should return a JSON object`);
  assert.ok("data" in payload, `${label} should include data`);
  assert.ok("error" in payload, `${label} should include error`);
  assert.ok("requestId" in payload, `${label} should include requestId`);
  assert.equal(payload.data, null, `${label} should have data=null`);
  assert.ok(payload.error && typeof payload.error === "object", `${label} should include error object`);
  assert.equal(typeof payload.requestId, "string", `${label} requestId should be a string`);
  assert.notEqual(payload.requestId.length, 0, `${label} requestId should not be empty`);

  return payload;
}

function assertStructuredDailyReport(report, dailyEntryId, label) {
  assert.ok(report && typeof report === "object", `${label} should return a structured report object`);
  assert.equal(typeof report.id, "string", `${label} report id should be a string`);
  assert.equal(report.dailyEntryId, dailyEntryId, `${label} dailyEntryId should match created entry id`);
  assert.equal(typeof report.createdAt, "string", `${label} createdAt should be a string`);
  assert.equal(typeof report.updatedAt, "string", `${label} updatedAt should be a string`);
}

function assertStructuredFieldsMatch(report, expected, label) {
  for (const fieldName of Object.keys(expected)) {
    assert.deepEqual(report[fieldName], expected[fieldName], `${label} ${fieldName} should match request payload`);
  }
}

function formatError(error) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

function logStep(message) {
  console.log(`[verify:structured-daily-report] ${message}`);
}

function logPass(message) {
  console.log(`[verify:structured-daily-report] PASS ${message}`);
}

function logFail(message) {
  console.error(`[verify:structured-daily-report] FAIL ${message}`);
}
