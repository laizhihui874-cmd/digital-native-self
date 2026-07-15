#!/usr/bin/env node

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";
assertIsolatedVerificationRuntime();

import assert from "node:assert/strict";
import crypto from "node:crypto";

const DEFAULT_BASE_URL = "http://localhost:3001";
const REQUEST_TIMEOUT_MS = 10_000;

const baseUrl = normalizeBaseUrl(
  process.env.METRIC_RATINGS_API_BASE_URL ??
    process.env.DAILY_ENTRY_API_BASE_URL ??
    process.env.API_BASE_URL ??
    DEFAULT_BASE_URL,
);
const now = new Date().toISOString();
const createdRawContent = `verify-metric-ratings ${now}`;
const missingDailyEntryId = crypto.randomUUID();

try {
  logStep(`Using base URL: ${baseUrl}`);

  const createEntryResponse = await requestJson("/api/daily-entries", {
    method: "POST",
    body: {
      rawContent: createdRawContent,
    },
  });
  assertOkStatus(createEntryResponse, "POST /api/daily-entries");
  const createdEntry = expectSuccessEnvelope(createEntryResponse.payload, "POST /api/daily-entries");
  assert.equal(typeof createdEntry.id, "string", "created entry id should be a string");
  logPass(`POST /api/daily-entries created id=${createdEntry.id}`);

  const firstUpsertResponse = await requestJson(
    `/api/daily-entries/${createdEntry.id}/metric-ratings`,
    {
      method: "POST",
      body: {
        metricType: "growth",
        aiScore: 4,
        aiReason: `first growth rating ${now}`,
        confirmedByUser: false,
      },
    },
  );
  assertOkStatus(firstUpsertResponse, `POST /api/daily-entries/${createdEntry.id}/metric-ratings`);
  const firstMetric = expectSuccessEnvelope(
    firstUpsertResponse.payload,
    `POST /api/daily-entries/${createdEntry.id}/metric-ratings`,
  );
  assert.equal(firstMetric.metricType, "growth");
  assert.equal(firstMetric.aiScore, 4);
  assert.equal(firstMetric.userScore, null);
  assert.equal(firstMetric.finalScore, null);
  assert.equal(firstMetric.aiReason, `first growth rating ${now}`);
  assert.equal(firstMetric.confirmedByUser, false);
  logPass("First POST /metric-ratings created growth metric");

  const firstListResponse = await requestJson(`/api/daily-entries/${createdEntry.id}/metric-ratings`);
  assertOkStatus(firstListResponse, `GET /api/daily-entries/${createdEntry.id}/metric-ratings`);
  const firstMetrics = expectSuccessEnvelope(
    firstListResponse.payload,
    `GET /api/daily-entries/${createdEntry.id}/metric-ratings`,
  );
  assert.ok(Array.isArray(firstMetrics), "metric list should be an array");
  assert.equal(firstMetrics.length, 1, "metric list should contain one item after first upsert");
  assert.equal(firstMetrics[0].metricType, "growth");
  logPass("First GET /metric-ratings returned one growth metric");

  const secondUpsertResponse = await requestJson(
    `/api/daily-entries/${createdEntry.id}/metric-ratings`,
    {
      method: "POST",
      body: {
        metricType: "growth",
        userScore: 5,
        finalScore: 5,
        confirmedByUser: true,
      },
    },
  );
  assertOkStatus(secondUpsertResponse, `POST /api/daily-entries/${createdEntry.id}/metric-ratings second call`);
  const secondMetric = expectSuccessEnvelope(
    secondUpsertResponse.payload,
    `POST /api/daily-entries/${createdEntry.id}/metric-ratings second call`,
  );
  assert.equal(secondMetric.metricType, "growth");
  assert.equal(secondMetric.aiScore, 4);
  assert.equal(secondMetric.userScore, 5);
  assert.equal(secondMetric.finalScore, 5);
  assert.equal(secondMetric.confirmedByUser, true);
  assert.equal(secondMetric.aiReason, `first growth rating ${now}`);
  logPass("Second POST /metric-ratings preserved ai fields and updated user fields");

  const secondListResponse = await requestJson(`/api/daily-entries/${createdEntry.id}/metric-ratings`);
  assertOkStatus(secondListResponse, `GET /api/daily-entries/${createdEntry.id}/metric-ratings second call`);
  const secondMetrics = expectSuccessEnvelope(
    secondListResponse.payload,
    `GET /api/daily-entries/${createdEntry.id}/metric-ratings second call`,
  );
  assert.ok(Array.isArray(secondMetrics), "metric list should remain an array");
  assert.equal(secondMetrics.length, 1, "metric list should still contain one item after upsert");
  assert.equal(secondMetrics[0].metricType, "growth");
  assert.equal(secondMetrics[0].aiScore, 4);
  assert.equal(secondMetrics[0].userScore, 5);
  assert.equal(secondMetrics[0].finalScore, 5);
  assert.equal(secondMetrics[0].confirmedByUser, true);
  assert.equal(secondMetrics[0].aiReason, `first growth rating ${now}`);
  logPass("Second GET /metric-ratings still returned one growth metric with preserved ai fields");

  const invalidScoreResponse = await requestJson(`/api/daily-entries/${createdEntry.id}/metric-ratings`, {
    method: "POST",
    body: {
      metricType: "growth",
      aiScore: 6,
    },
  });
  assert.equal(
    invalidScoreResponse.status,
    400,
    `invalid score should return 400, got ${invalidScoreResponse.status} ${invalidScoreResponse.statusText}`,
  );
  logPass("Invalid score returned 400");

  const missingEntryResponse = await requestJson(`/api/daily-entries/${missingDailyEntryId}/metric-ratings`, {
    method: "POST",
    body: {
      metricType: "growth",
      aiScore: 4,
    },
  });
  assert.equal(
    missingEntryResponse.status,
    404,
    `missing dailyEntryId should return 404, got ${missingEntryResponse.status} ${missingEntryResponse.statusText}`,
  );
  logPass("Unknown dailyEntryId returned 404");

  logPass("Metric ratings API verification completed");
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
  console.log(`[verify:metric-ratings] ${message}`);
}

function logPass(message) {
  console.log(`[verify:metric-ratings] PASS ${message}`);
}

function logFail(message) {
  console.error(`[verify:metric-ratings] FAIL ${message}`);
}
