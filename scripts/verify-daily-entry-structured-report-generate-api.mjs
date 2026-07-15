#!/usr/bin/env node

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";
assertIsolatedVerificationRuntime();

import assert from "node:assert/strict";

const DEFAULT_BASE_URL = "http://localhost:3001";
const REQUEST_TIMEOUT_MS = 10_000;

const baseUrl = normalizeBaseUrl(
  process.env.DAILY_ENTRY_STRUCTURED_GENERATE_API_BASE_URL ??
    process.env.STRUCTURED_REPORT_API_BASE_URL ??
    process.env.API_BASE_URL ??
    DEFAULT_BASE_URL,
);
const now = new Date().toISOString();
const createdRawContent = [
  `今天完成了结构化日报真实生成接口联调，并准备把 AI 评分作为待确认建议 ${now}。`,
  `上午和同事沟通接口边界，发现表达仍然不够清楚，但已经能把问题拆成验收点 ${now}。`,
  `下午有些焦虑和疲惫，担心继续做低价值任务会影响 7月2日 前的选择 ${now}。`,
  `我学会了把事实、情绪、成长证据和下一步行动分开记录 ${now}。`,
  `明天准备继续完善简历项目和外部信息整理 ${now}。`,
].join("\n");

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

  const generateResponse = await requestJson(
    `/api/daily-entries/${createdEntry.id}/structured-report-generate`,
    {
      method: "POST",
    },
  );
  assertOkStatus(
    generateResponse,
    `POST /api/daily-entries/${createdEntry.id}/structured-report-generate`,
  );
  const generatedReport = expectSuccessEnvelope(
    generateResponse.payload,
    `POST /api/daily-entries/${createdEntry.id}/structured-report-generate`,
  );

  assertStructuredDailyReport(
    generatedReport,
    createdEntry.id,
    `POST /api/daily-entries/${createdEntry.id}/structured-report-generate`,
  );
  assertStructuredArray(generatedReport.facts, "facts", 1);
  assertStructuredArray(generatedReport.emotions, "emotions", 1);
  assertStructuredArray(generatedReport.workItems, "workItems", 1);
  assertStructuredArray(generatedReport.feedback, "feedback", 1);
  assertStructuredArray(generatedReport.growthEvidence, "growthEvidence", 1);
  assertStructuredArray(generatedReport.drainSources, "drainSources", 1);
  assertStructuredArray(generatedReport.nextActions, "nextActions", 1);
  assertStructuredArray(generatedReport.decisionImpact, "decisionImpact", 1);
  logPass("Generated structured report returned all expected sections");

  const entryDetailResponse = await requestJson(`/api/daily-entries/${createdEntry.id}`);
  assertOkStatus(entryDetailResponse, `GET /api/daily-entries/${createdEntry.id}`);
  const entryDetail = expectSuccessEnvelope(
    entryDetailResponse.payload,
    `GET /api/daily-entries/${createdEntry.id}`,
  );
  assert.equal(
    entryDetail.structuredReport?.id,
    generatedReport.id,
    "DailyEntry detail should include the generated structured report",
  );
  logPass("DailyEntry detail includes generated structured report");

  const ratingsResponse = await requestJson(
    `/api/daily-entries/${createdEntry.id}/metric-ratings`,
  );
  assertOkStatus(ratingsResponse, `GET /api/daily-entries/${createdEntry.id}/metric-ratings`);
  const metricRatings = expectSuccessEnvelope(
    ratingsResponse.payload,
    `GET /api/daily-entries/${createdEntry.id}/metric-ratings`,
  );

  assert.ok(Array.isArray(metricRatings), "metric ratings response should be an array");
  assert.equal(metricRatings.length, 4, "generated report should create 4 metric ratings");

  const expectedMetricTypes = new Set([
    "growth",
    "emotional_drain",
    "long_term_fit",
    "communication_pressure",
  ]);
  for (const metricRating of metricRatings) {
    assert.ok(
      expectedMetricTypes.has(metricRating.metricType),
      `unexpected metricType ${metricRating.metricType}`,
    );
    assert.equal(typeof metricRating.aiScore, "number", `${metricRating.metricType}.aiScore should exist`);
    assert.ok(
      metricRating.aiScore >= 1 && metricRating.aiScore <= 5,
      `${metricRating.metricType}.aiScore should be 1..5`,
    );
    assert.equal(typeof metricRating.aiReason, "string", `${metricRating.metricType}.aiReason should exist`);
    assert.notEqual(
      metricRating.aiReason.trim().length,
      0,
      `${metricRating.metricType}.aiReason should not be empty`,
    );
    assert.equal(metricRating.confirmedByUser, false, "AI ratings should remain unconfirmed");
  }
  logPass("Generated metric ratings were created as unconfirmed AI suggestions");

  const duplicateGenerateResponse = await requestJson(
    `/api/daily-entries/${createdEntry.id}/structured-report-generate`,
    {
      method: "POST",
    },
  );
  assert.equal(
    duplicateGenerateResponse.status,
    409,
    `duplicate generate request should return 409, got ${duplicateGenerateResponse.status}`,
  );
  const duplicatePayload = expectErrorEnvelope(
    duplicateGenerateResponse.payload,
    `POST /api/daily-entries/${createdEntry.id}/structured-report-generate duplicate`,
  );
  assert.match(
    duplicatePayload.error.message,
    /already exists/i,
    "duplicate generate error should mention existing structured report",
  );
  logPass("Duplicate structured report generate request returned 409");

  logPass("DailyEntry structured report generate verification completed");
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

function assertStructuredArray(value, fieldName, minLength) {
  assert.ok(Array.isArray(value), `${fieldName} should be an array`);
  assert.ok(
    value.length >= minLength,
    `${fieldName} should contain at least ${minLength} item(s), got ${value.length}`,
  );

  for (const item of value) {
    assert.ok(item && typeof item === "object", `${fieldName} item should be an object`);
    assert.equal(typeof item.detail, "string", `${fieldName} item detail should be a string`);
    assert.notEqual(item.detail.trim().length, 0, `${fieldName} item detail should not be empty`);
  }
}

function formatError(error) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

function logStep(message) {
  console.log(`[verify:daily-entry-structured-report-generate] ${message}`);
}

function logPass(message) {
  console.log(`[verify:daily-entry-structured-report-generate] PASS ${message}`);
}

function logFail(message) {
  console.error(`[verify:daily-entry-structured-report-generate] FAIL ${message}`);
}
