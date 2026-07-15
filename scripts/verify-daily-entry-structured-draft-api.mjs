#!/usr/bin/env node

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";
assertIsolatedVerificationRuntime();

import assert from "node:assert/strict";

const DEFAULT_BASE_URL = "http://localhost:3001";
const REQUEST_TIMEOUT_MS = 10_000;

const baseUrl = normalizeBaseUrl(
  process.env.DAILY_ENTRY_STRUCTURED_DRAFT_API_BASE_URL ??
    process.env.STRUCTURED_REPORT_API_BASE_URL ??
    process.env.API_BASE_URL ??
    DEFAULT_BASE_URL,
);
const now = new Date().toISOString();
const createdRawContent = [
  `今天完成了 DailyEntry 到 StructuredDailyReport 草稿接口联调，并修复了 memory-candidates 的重复创建分支 ${now}。`,
  `和同事沟通了接口细节，也整理了测试脚本与回归说明 ${now}。`,
  `下午收到评审反馈，说返回语义要更克制，还需要补充验证 ${now}。`,
  `虽然有点焦虑也有些累，但我学会了把重复创建和幂等场景拆开处理 ${now}。`,
  `接下来准备明天继续补充验证脚本 ${now}。`,
  `这让我更需要在 7月2日 ${now} 前判断继续工作、换工作还是离职考研。`,
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

  const draftResponse = await requestJson(
    `/api/daily-entries/${createdEntry.id}/structured-report-draft`,
    {
      method: "POST",
    },
  );
  assertOkStatus(
    draftResponse,
    `POST /api/daily-entries/${createdEntry.id}/structured-report-draft`,
  );
  const createdDraft = expectSuccessEnvelope(
    draftResponse.payload,
    `POST /api/daily-entries/${createdEntry.id}/structured-report-draft`,
  );

  assertStructuredDailyReport(
    createdDraft,
    createdEntry.id,
    `POST /api/daily-entries/${createdEntry.id}/structured-report-draft`,
  );
  assertStructuredArray(createdDraft.facts, "facts", 1, 3);
  assertStructuredArray(createdDraft.emotions, "emotions", 1);
  assertStructuredArray(createdDraft.workItems, "workItems", 1);
  assertStructuredArray(createdDraft.feedback, "feedback", 1);
  assertStructuredArray(createdDraft.growthEvidence, "growthEvidence", 1);
  assertStructuredArray(createdDraft.drainSources, "drainSources", 1);
  assertStructuredArray(createdDraft.nextActions, "nextActions", 1);
  assertStructuredArray(createdDraft.decisionImpact, "decisionImpact", 1);
  logPass("Structured report draft returned all expected structured arrays");

  const duplicateDraftResponse = await requestJson(
    `/api/daily-entries/${createdEntry.id}/structured-report-draft`,
    {
      method: "POST",
    },
  );
  assert.equal(
    duplicateDraftResponse.status,
    409,
    `duplicate draft creation should return 409, got ${duplicateDraftResponse.status}`,
  );
  const duplicateDraftPayload = expectErrorEnvelope(
    duplicateDraftResponse.payload,
    `POST /api/daily-entries/${createdEntry.id}/structured-report-draft duplicate`,
  );
  assert.match(
    duplicateDraftPayload.error.message,
    /already exists/i,
    "duplicate draft error should mention existing structured report",
  );
  logPass("Duplicate structured report draft request returned 409");

  const memoryCandidatesResponse = await requestJson(
    `/api/structured-daily-reports/${createdEntry.id}/memory-candidates`,
    {
      method: "POST",
    },
  );
  assertOkStatus(
    memoryCandidatesResponse,
    `POST /api/structured-daily-reports/${createdEntry.id}/memory-candidates`,
  );
  const memoryCandidatesPayload = expectSuccessEnvelope(
    memoryCandidatesResponse.payload,
    `POST /api/structured-daily-reports/${createdEntry.id}/memory-candidates`,
  );

  assert.equal(memoryCandidatesPayload.source.dailyEntryId, createdEntry.id);
  assert.equal(memoryCandidatesPayload.source.structuredReportId, createdDraft.id);
  assert.ok(Array.isArray(memoryCandidatesPayload.created), "created should be an array");
  assert.ok(
    memoryCandidatesPayload.created.length >= 4,
    "draft-based memory extraction should create at least 4 candidates",
  );

  const createdTypes = new Set(memoryCandidatesPayload.created.map((item) => item.memoryType));
  for (const requiredType of ["ability", "goal", "decision", "event"]) {
    assert.ok(createdTypes.has(requiredType), `created candidates should include memoryType=${requiredType}`);
  }
  logPass("Draft-based memory candidates were created with expected types");

  logPass("DailyEntry -> structured report draft -> memory candidates verification completed");
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

function assertStructuredArray(value, fieldName, minLength, maxLength = Number.POSITIVE_INFINITY) {
  assert.ok(Array.isArray(value), `${fieldName} should be an array`);
  assert.ok(
    value.length >= minLength,
    `${fieldName} should contain at least ${minLength} item(s), got ${value.length}`,
  );
  assert.ok(
    value.length <= maxLength,
    `${fieldName} should contain at most ${maxLength} item(s), got ${value.length}`,
  );

  for (const item of value) {
    assert.ok(item && typeof item === "object", `${fieldName} item should be an object`);
    assert.equal(item.title, "本地草稿", `${fieldName} item title should mark local draft`);
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
  console.log(`[verify:daily-entry-structured-draft] ${message}`);
}

function logPass(message) {
  console.log(`[verify:daily-entry-structured-draft] PASS ${message}`);
}

function logFail(message) {
  console.error(`[verify:daily-entry-structured-draft] FAIL ${message}`);
}
