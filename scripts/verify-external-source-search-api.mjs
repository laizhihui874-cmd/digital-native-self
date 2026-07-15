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
const missingDecisionId = "33333333-3333-4333-8333-333333333333";

const baseUrl = normalizeBaseUrl(
  process.env.EXTERNAL_SOURCE_SEARCH_API_BASE_URL ??
    process.env.API_BASE_URL ??
    DEFAULT_BASE_URL,
);
const healthPath = process.env.EXTERNAL_SOURCE_SEARCH_HEALTH_PATH ?? DEFAULT_HEALTH_PATH;
const suffix = new Date().toISOString().replace(/[:.]/g, "-");
let serverProcess = null;

try {
  logStep(`Using base URL: ${baseUrl}`);
  serverProcess = await ensureApiServer();

  const decision = expectSuccessEnvelope(
    (await requestJson("/api/life-decisions", {
      method: "POST",
      body: {
        title: `verify-external-search-decision-${suffix}`,
        description: "用于验证外部信息搜索结果可关联 active decision。",
        status: "active",
      },
    })).payload,
    "POST /api/life-decisions",
  );

  const searchResponse = await requestJson("/api/external-sources/search", {
    method: "POST",
    body: {
      query: `广州 AI 应用工程师 岗位要求 ${suffix}`,
      category: "ai_role",
      lifeDecisionId: decision.id,
      limit: 2,
    },
  });
  assertOkStatus(searchResponse, "POST /api/external-sources/search");
  const searchResult = expectSuccessEnvelope(
    searchResponse.payload,
    "POST /api/external-sources/search",
  );

  assert.equal(searchResult.query, `广州 AI 应用工程师 岗位要求 ${suffix}`);
  assert.equal(searchResult.category, "ai_role");
  assert.equal(searchResult.searchMode, "fake", "local verification should run fake provider");
  assert.equal(searchResult.sourceSnapshot.provider, "fake");
  assert.equal(searchResult.sourceSnapshot.requestedLimit, 2);
  assert.equal(searchResult.items.length, 2, "fake provider should return requested item count");
  assert.equal(searchResult.savedItems.length, 2, "search should save returned fake items");
  assert.ok(
    searchResult.savedItems.every((item) => item.lifeDecisionId === decision.id),
    "saved search results should bind to the requested lifeDecisionId",
  );
  assert.ok(
    searchResult.savedItems.every((item) => item.url.startsWith("https://")),
    "saved search results should keep source URLs",
  );
  assert.ok(
    searchResult.summary.includes("deterministic"),
    "summary should disclose deterministic summary boundary",
  );
  logPass("POST /api/external-sources/search saved fake provider results with citations");

  const listResponse = await requestJson(
    `/api/external-sources?lifeDecisionId=${decision.id}&limit=10&offset=0`,
  );
  assertOkStatus(listResponse, "GET /api/external-sources?lifeDecisionId");
  const listedSources = expectSuccessEnvelope(
    listResponse.payload,
    "GET /api/external-sources?lifeDecisionId",
  );
  assert.ok(
    searchResult.savedItems.every((saved) =>
      listedSources.items.some((listed) => listed.id === saved.id),
    ),
    "saved search results should be queryable as ExternalSource records",
  );
  logPass("Saved search results are queryable through ExternalSource list");

  const genericSearchResponse = await requestJson("/api/external-sources/search", {
    method: "POST",
    body: {
      query: `华南师范大学 外国哲学 考研 ${suffix}`,
      category: "postgraduate",
      limit: 1,
    },
  });
  assertOkStatus(genericSearchResponse, "POST /api/external-sources/search without decision");
  const genericSearch = expectSuccessEnvelope(
    genericSearchResponse.payload,
    "POST /api/external-sources/search without decision",
  );
  assert.equal(genericSearch.savedItems.length, 1, "unbound search should still save result");
  assert.equal(genericSearch.savedItems[0].lifeDecisionId, null, "unbound search should not attach decision");
  logPass("POST /api/external-sources/search works without lifeDecisionId");

  const emptyQueryResponse = await requestJson("/api/external-sources/search", {
    method: "POST",
    body: {
      query: "   ",
      limit: 1,
    },
  });
  assert.equal(emptyQueryResponse.status, 400, "empty query should return 400");
  expectErrorEnvelope(emptyQueryResponse.payload, "POST /api/external-sources/search empty query");
  logPass("POST /api/external-sources/search rejected empty query");

  const invalidLimitResponse = await requestJson("/api/external-sources/search", {
    method: "POST",
    body: {
      query: "AI 应用开发",
      limit: 11,
    },
  });
  assert.equal(invalidLimitResponse.status, 400, "limit > 10 should return 400");
  expectErrorEnvelope(invalidLimitResponse.payload, "POST /api/external-sources/search invalid limit");
  logPass("POST /api/external-sources/search rejected invalid limit");

  const missingDecisionResponse = await requestJson("/api/external-sources/search", {
    method: "POST",
    body: {
      query: "AI 应用开发",
      lifeDecisionId: missingDecisionId,
      limit: 1,
    },
  });
  assert.equal(missingDecisionResponse.status, 404, "missing lifeDecisionId should return 404");
  expectErrorEnvelope(missingDecisionResponse.payload, "POST /api/external-sources/search missing decision");
  logPass("POST /api/external-sources/search rejected missing lifeDecisionId");

  logPass("ExternalSource search API verification completed");
} catch (error) {
  logFail(formatError(error));
  process.exit(1);
} finally {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
  }
}

async function ensureApiServer() {
  if (await isApiHealthy()) {
    logStep("Detected an existing API server");
    return null;
  }

  logStep("Starting the built API server for verification with fake search provider");
  const child = spawn(process.execPath, ["--env-file=.env", "apps/api/dist/main.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      EXTERNAL_SOURCE_SEARCH_PROVIDER: process.env.EXTERNAL_SOURCE_SEARCH_PROVIDER ?? "fake",
    },
    stdio: "inherit",
  });

  const started = await waitForApiHealth();

  if (!started) {
    child.kill("SIGTERM");
    throw new Error(`API server did not become healthy within ${SERVER_BOOT_TIMEOUT_MS}ms`);
  }

  logStep("API server is healthy");
  return child;
}

async function waitForApiHealth() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < SERVER_BOOT_TIMEOUT_MS) {
    if (await isApiHealthy()) {
      return true;
    }

    await delay(500);
  }

  return false;
}

async function isApiHealthy() {
  try {
    const response = await fetch(`${baseUrl}${healthPath}`, {
      signal: AbortSignal.timeout(2_000),
    });

    return response.ok;
  } catch {
    return false;
  }
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

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
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

  return payload;
}

function formatError(error) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

function logStep(message) {
  console.log(`[verify:external-source-search] ${message}`);
}

function logPass(message) {
  console.log(`[verify:external-source-search] PASS ${message}`);
}

function logFail(message) {
  console.error(`[verify:external-source-search] FAIL ${message}`);
}
