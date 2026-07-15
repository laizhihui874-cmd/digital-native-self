#!/usr/bin/env node

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";
assertIsolatedVerificationRuntime();

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const DEFAULT_BASE_URL = "http://localhost:3001";
const DEFAULT_HEALTH_PATH = "/api/health";
const REQUEST_TIMEOUT_MS = 10_000;
const SERVER_BOOT_TIMEOUT_MS = 30_000;
const METRIC_TYPES = [
  "growth",
  "emotional_drain",
  "long_term_fit",
  "communication_pressure",
];

const baseUrl = normalizeBaseUrl(
  process.env.WEEKLY_REVIEWS_API_BASE_URL ?? process.env.API_BASE_URL ?? DEFAULT_BASE_URL,
);
const healthPath = process.env.WEEKLY_REVIEWS_HEALTH_PATH ?? DEFAULT_HEALTH_PATH;
const suffix = new Date().toISOString().replace(/[:.]/g, "-");

let serverProcess = null;

try {
  logStep(`Using base URL: ${baseUrl}`);
  serverProcess = await ensureApiServer();

  const periodStart = new Date();
  periodStart.setUTCDate(periodStart.getUTCDate() - 6);
  periodStart.setUTCHours(0, 0, 0, 0);

  const periodEnd = new Date();
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 1);
  periodEnd.setUTCHours(23, 59, 59, 999);
  const isoPeriodStart = periodStart.toISOString();
  const isoPeriodEnd = periodEnd.toISOString();

  const dailyEntryIds = [];

  for (let index = 0; index < 7; index += 1) {
    const recordedAt = new Date(periodStart);
    recordedAt.setUTCDate(periodStart.getUTCDate() + index);
    recordedAt.setUTCHours(9, 0, 0, 0);

    const createdEntry = await postJson("/api/daily-entries", {
      rawContent: `weekly-review-entry-${suffix}-${index}`,
      recordedAt: recordedAt.toISOString(),
    });
    dailyEntryIds.push(createdEntry.id);

    await postJson("/api/structured-daily-reports", {
      dailyEntryId: createdEntry.id,
      facts: [
        {
          title: `事实 ${index + 1}`,
          detail: `完成第 ${index + 1} 天的关键工作并记录产出 ${suffix}`,
        },
      ],
      emotions: [
        {
          title: index % 2 === 0 ? "专注" : "疲惫",
          detail: `第 ${index + 1} 天情绪状态 ${suffix}`,
        },
      ],
      workItems: [
        {
          title: `事项 ${index + 1}`,
          detail: `推进本周任务切片 ${index + 1}`,
        },
      ],
      feedback: [],
      growthEvidence: [
        {
          title: "成长证据",
          detail: `沉淀第 ${index + 1} 天的方法复盘`,
        },
      ],
      drainSources: [
        {
          title: "消耗源",
          detail: `第 ${index + 1} 天的上下文切换较多`,
        },
      ],
      nextActions: [
        {
          title: "下一步",
          detail: `完成第 ${index + 1} 天后续动作`,
        },
      ],
      decisionImpact: [
        {
          title: "决策影响",
          detail: `第 ${index + 1} 天的经历影响了未来路径判断`,
        },
      ],
    });

    for (const [metricIndex, metricType] of METRIC_TYPES.entries()) {
      await postJson(`/api/daily-entries/${createdEntry.id}/metric-ratings`, {
        metricType,
        finalScore: 5 - ((index + metricIndex) % 3),
        confirmedByUser: true,
      });
    }
  }

  await postJson("/api/memories", {
    memoryType: "decision",
    content: `确认本周更适合走深度投入路径 ${suffix}`,
    status: "confirmed",
  });

  const lifeDecision = await postJson("/api/life-decisions", {
    title: `weekly-review-decision-${suffix}`,
    description: `为周回顾验证创建的决策 ${suffix}`,
  });
  const decisionPath = await postJson(`/api/life-decisions/${lifeDecision.id}/paths`, {
    title: `weekly-review-path-${suffix}`,
    description: `首选路径 ${suffix}`,
  });
  await postJson("/api/decision-evidence", {
    decisionId: lifeDecision.id,
    pathId: decisionPath.id,
    evidenceType: "support",
    content: `本周证据支持继续投入该路径 ${suffix}`,
  });

  const generatePayload = {
    periodStart: isoPeriodStart,
    periodEnd: isoPeriodEnd,
    lifeDecisionId: lifeDecision.id,
  };

  const generated = await postJson("/api/weekly-reviews/generate", generatePayload);
  assert.equal(generated.generationMode, "deterministic", "generationMode should be deterministic");
  assert.ok(generated.weeklyReview && typeof generated.weeklyReview === "object", "weeklyReview should exist");
  assertWeeklyReviewDetail(generated.weeklyReview, "POST /api/weekly-reviews/generate");
  assert.equal(generated.weeklyReview.lifeDecisionId, lifeDecision.id, "lifeDecisionId should match request");
  assert.ok(
    generated.sourceSnapshot.dailyEntriesRead >= 7,
    "sourceSnapshot.dailyEntriesRead should include the 7 seeded daily entries",
  );
  assert.ok(
    generated.sourceSnapshot.structuredReportsRead >= 7,
    "sourceSnapshot.structuredReportsRead should include the 7 seeded structured reports",
  );
  assert.ok(
    generated.sourceSnapshot.metricRatingsRead >= 28,
    "sourceSnapshot.metricRatingsRead should include the seeded metric ratings",
  );
  assert.ok(
    generated.sourceSnapshot.confirmedMemoriesRead >= 1,
    "sourceSnapshot.confirmedMemoriesRead should include the seeded confirmed memory",
  );
  assert.equal(
    generated.sourceSnapshot.decisionEvidenceRead,
    1,
    "sourceSnapshot.decisionEvidenceRead should equal the seeded evidence count for the scoped decision",
  );
  logPass(`POST /api/weekly-reviews/generate created id=${generated.weeklyReview.id}`);

  const latest = await getJson(`/api/weekly-reviews/latest?lifeDecisionId=${lifeDecision.id}`);
  assert.ok(latest, "GET /api/weekly-reviews/latest should return a review");
  assert.equal(latest.id, generated.weeklyReview.id, "latest review id should match generated id");
  logPass("GET /api/weekly-reviews/latest returned the generated review");

  const byPeriod = await getJson(
    `/api/weekly-reviews?periodStart=${encodeURIComponent(isoPeriodStart)}&periodEnd=${encodeURIComponent(isoPeriodEnd)}&lifeDecisionId=${lifeDecision.id}`,
  );
  assert.ok(byPeriod, "GET /api/weekly-reviews should return a review for the period");
  assert.equal(byPeriod.id, generated.weeklyReview.id, "period lookup should return the generated review");
  logPass("GET /api/weekly-reviews returned the generated review for the target period");

  const generatedAgain = await postJson("/api/weekly-reviews/generate", generatePayload);
  assert.equal(
    generatedAgain.weeklyReview.id,
    generated.weeklyReview.id,
    "repeat generate should reuse the same weekly review id",
  );
  assert.deepEqual(
    generatedAgain.sourceSnapshot,
    generated.sourceSnapshot,
    "repeat generate should not change source counts",
  );
  logPass("Repeated POST /api/weekly-reviews/generate stayed idempotent");

  const emptyPeriodStart = new Date(periodEnd);
  emptyPeriodStart.setUTCDate(emptyPeriodStart.getUTCDate() + 30);
  emptyPeriodStart.setUTCHours(0, 0, 0, 0);

  const emptyPeriodEnd = new Date(emptyPeriodStart);
  emptyPeriodEnd.setUTCDate(emptyPeriodEnd.getUTCDate() + 6);
  emptyPeriodEnd.setUTCHours(23, 59, 59, 999);

  const emptyGenerated = await postJson("/api/weekly-reviews/generate", {
    periodStart: emptyPeriodStart.toISOString(),
    periodEnd: emptyPeriodEnd.toISOString(),
  });
  assertWeeklyReviewDetail(emptyGenerated.weeklyReview, "POST /api/weekly-reviews/generate empty week");
  assert.deepEqual(
    emptyGenerated.sourceSnapshot,
    {
      dailyEntriesRead: 0,
      structuredReportsRead: 0,
      metricRatingsRead: 0,
      confirmedMemoriesRead: 0,
      decisionEvidenceRead: 0,
    },
    "empty week should return zero source counts",
  );
  logPass("Empty week generation succeeded without source data");

  logPass("WeeklyReview API verification completed");
} catch (error) {
  logFail(formatError(error));
  process.exitCode = 1;
} finally {
  await stopApiServer(serverProcess);
}

function assertWeeklyReviewDetail(review, label) {
  assert.equal(typeof review.id, "string", `${label} should return weeklyReview.id`);
  assert.equal(typeof review.progressSummary, "string", `${label} should return progressSummary`);
  assert.ok(Array.isArray(review.abilityChanges), `${label} should return abilityChanges array`);
  assert.ok(Array.isArray(review.emotionPatterns), `${label} should return emotionPatterns array`);
  assert.equal(typeof review.goalDrift, "string", `${label} should return goalDrift`);
  assert.ok(Array.isArray(review.nextWeekSuggestions), `${label} should return nextWeekSuggestions array`);
  assert.equal(typeof review.lifePossibilityNotes, "string", `${label} should return lifePossibilityNotes`);
  assert.ok(review.emotionPattern && typeof review.emotionPattern === "object", `${label} should return emotionPattern`);
  assert.ok(Array.isArray(review.emotionPattern.dominantEmotions), `${label} emotionPattern should include dominantEmotions`);
  assert.ok(Array.isArray(review.emotionPattern.triggers), `${label} emotionPattern should include triggers`);
  assert.ok(Array.isArray(review.emotionPattern.patterns), `${label} emotionPattern should include patterns`);
}

async function ensureApiServer() {
  if (await isApiHealthy(baseUrl)) {
    logStep("Detected an existing healthy API server");
    return null;
  }

  logStep("Starting the built API server for weekly review verification");
  const child = spawn(process.execPath, ["--env-file=.env", "apps/api/dist/main.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(new URL(baseUrl).port || "3001"),
    },
    stdio: "inherit",
  });

  await waitForHealthyServer(baseUrl);
  return child;
}

async function stopApiServer(child) {
  if (!child) {
    return;
  }

  if (child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(5_000),
  ]);
}

async function waitForHealthyServer(targetBaseUrl) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < SERVER_BOOT_TIMEOUT_MS) {
    if (await isApiHealthy(targetBaseUrl)) {
      return;
    }

    await delay(500);
  }

  throw new Error(`API server at ${targetBaseUrl} did not become healthy within ${SERVER_BOOT_TIMEOUT_MS}ms.`);
}

async function isApiHealthy(targetBaseUrl) {
  try {
    const response = await fetch(`${targetBaseUrl}${healthPath}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function postJson(pathname, body) {
  return requestJson(pathname, {
    method: "POST",
    body,
  });
}

async function getJson(pathname) {
  return requestJson(pathname);
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

  if (!response.ok) {
    throw new Error(
      `${options.method ?? "GET"} ${pathname} failed with ${response.status} ${response.statusText}: ${rawText || "<empty body>"}`,
    );
  }

  return expectSuccessEnvelope(payload, `${options.method ?? "GET"} ${pathname}`);
}

function expectSuccessEnvelope(payload, label) {
  assert.ok(payload && typeof payload === "object", `${label} should return a JSON object`);
  assert.ok("data" in payload, `${label} should include data`);
  assert.ok("error" in payload, `${label} should include error`);
  assert.ok("requestId" in payload, `${label} should include requestId`);
  assert.equal(payload.error, null, `${label} should have error=null`);
  assert.equal(typeof payload.requestId, "string", `${label} requestId should be a string`);

  return payload.data;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function formatError(error) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

function logStep(message) {
  console.log(`[verify:weekly-reviews] ${message}`);
}

function logPass(message) {
  console.log(`[verify:weekly-reviews] PASS ${message}`);
}

function logFail(message) {
  console.error(`[verify:weekly-reviews] FAIL ${message}`);
}
