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

const baseUrl = normalizeBaseUrl(process.env.LIFE_DECISIONS_API_BASE_URL ?? process.env.API_BASE_URL ?? DEFAULT_BASE_URL);
const healthPath = process.env.LIFE_DECISIONS_HEALTH_PATH ?? DEFAULT_HEALTH_PATH;
const suffix = new Date().toISOString().replace(/[:.]/g, "-");

const createDecisionPayload = {
  title: `  verify-life-decision-${suffix}  `,
  description: `需要在 ${suffix} 前做出选择`,
  deadline: "2026-12-31T00:00:00.000Z",
  finalDecision: `  初始判断-${suffix}  `,
};

const updateDecisionPayload = {
  title: `verify-life-decision-updated-${suffix}`,
  description: null,
  deadline: null,
  status: "decided",
  finalDecision: `确认执行方案 ${suffix}`,
};

const createPathPayload = {
  title: `  path-${suffix}  `,
  description: `候选路径 ${suffix}`,
  currentScore: 7.5,
};

const updatePathPayload = {
  title: `path-updated-${suffix}`,
  description: null,
  benefits: [`收益-${suffix}`, "验证默认值后补写收益"],
  risks: [`风险-${suffix}`],
  currentScore: 8.25,
};

const missingDecisionId = "11111111-1111-4111-8111-111111111111";
const missingPathId = "33333333-3333-4333-8333-333333333333";

let serverProcess = null;

try {
  logStep(`Using base URL: ${baseUrl}`);
  serverProcess = await ensureApiServer();

  const createdDecisionResponse = await requestJson("/api/life-decisions", {
    method: "POST",
    body: createDecisionPayload,
  });
  assertOkStatus(createdDecisionResponse, "POST /api/life-decisions");
  const createdDecision = expectSuccessEnvelope(
    createdDecisionResponse.payload,
    "POST /api/life-decisions",
  );

  assert.equal(createdDecision.title, createDecisionPayload.title.trim(), "created decision title should be trimmed");
  assert.equal(createdDecision.description, createDecisionPayload.description, "created decision description should match");
  assert.equal(createdDecision.deadline, createDecisionPayload.deadline, "created decision deadline should match");
  assert.equal(createdDecision.status, "active", "created decision status should default to active");
  assert.equal(
    createdDecision.finalDecision,
    createDecisionPayload.finalDecision.trim(),
    "created decision finalDecision should be trimmed",
  );
  logPass(`POST /api/life-decisions created id=${createdDecision.id}`);

  const createdSiblingDecisionResponse = await requestJson("/api/life-decisions", {
    method: "POST",
    body: {
      title: `verify-life-decision-sibling-${suffix}`,
    },
  });
  assertOkStatus(createdSiblingDecisionResponse, "POST /api/life-decisions sibling");
  const createdSiblingDecision = expectSuccessEnvelope(
    createdSiblingDecisionResponse.payload,
    "POST /api/life-decisions sibling",
  );
  logPass(`POST /api/life-decisions created sibling id=${createdSiblingDecision.id}`);

  const listResponse = await requestJson("/api/life-decisions?status=active");
  assertOkStatus(listResponse, "GET /api/life-decisions?status=active");
  const listedDecisions = expectSuccessEnvelope(
    listResponse.payload,
    "GET /api/life-decisions?status=active",
  );

  assert.ok(Array.isArray(listedDecisions), "life-decision list should be an array");
  assert.ok(
    listedDecisions.some((item) => item.id === createdDecision.id),
    "life-decision list should include the created decision",
  );
  logPass("GET /api/life-decisions returned the created active decision");

  const detailBeforePathResponse = await requestJson(`/api/life-decisions/${createdDecision.id}`);
  assertOkStatus(detailBeforePathResponse, `GET /api/life-decisions/${createdDecision.id}`);
  const detailBeforePath = expectSuccessEnvelope(
    detailBeforePathResponse.payload,
    `GET /api/life-decisions/${createdDecision.id}`,
  );

  assert.equal(detailBeforePath.id, createdDecision.id, "life-decision detail id should match created id");
  assert.ok(Array.isArray(detailBeforePath.paths), "life-decision detail should include paths array");
  assert.deepEqual(detailBeforePath.paths, [], "new life-decision detail should start with no paths");
  assert.ok(Array.isArray(detailBeforePath.evidenceItems), "life-decision detail should include evidenceItems array");
  logPass("GET /api/life-decisions/:id returned paths and evidenceItems arrays");

  const updatedDecisionResponse = await requestJson(`/api/life-decisions/${createdDecision.id}`, {
    method: "PATCH",
    body: updateDecisionPayload,
  });
  assertOkStatus(updatedDecisionResponse, `PATCH /api/life-decisions/${createdDecision.id}`);
  const updatedDecision = expectSuccessEnvelope(
    updatedDecisionResponse.payload,
    `PATCH /api/life-decisions/${createdDecision.id}`,
  );

  assert.equal(updatedDecision.title, updateDecisionPayload.title, "updated decision title should match");
  assert.equal(updatedDecision.description, null, "updated decision description should become null");
  assert.equal(updatedDecision.deadline, null, "updated decision deadline should become null");
  assert.equal(updatedDecision.status, "decided", "updated decision status should match");
  assert.equal(
    updatedDecision.finalDecision,
    updateDecisionPayload.finalDecision,
    "updated decision finalDecision should match",
  );
  logPass("PATCH /api/life-decisions/:id updated the decision fields");

  const createdPathResponse = await requestJson(`/api/life-decisions/${createdDecision.id}/paths`, {
    method: "POST",
    body: createPathPayload,
  });
  assertOkStatus(createdPathResponse, `POST /api/life-decisions/${createdDecision.id}/paths`);
  const createdPath = expectSuccessEnvelope(
    createdPathResponse.payload,
    `POST /api/life-decisions/${createdDecision.id}/paths`,
  );

  assert.equal(createdPath.decisionId, createdDecision.id, "created path decisionId should match parent decision");
  assert.equal(createdPath.title, createPathPayload.title.trim(), "created path title should be trimmed");
  assert.equal(createdPath.description, createPathPayload.description, "created path description should match");
  assert.deepEqual(createdPath.benefits, [], "created path benefits should default to []");
  assert.deepEqual(createdPath.risks, [], "created path risks should default to []");
  assert.equal(createdPath.currentScore, createPathPayload.currentScore, "created path currentScore should match");
  logPass("POST /api/life-decisions/:decisionId/paths created a path with default arrays");

  const updatedPathResponse = await requestJson(
    `/api/life-decisions/${createdDecision.id}/paths/${createdPath.id}`,
    {
      method: "PATCH",
      body: updatePathPayload,
    },
  );
  assertOkStatus(
    updatedPathResponse,
    `PATCH /api/life-decisions/${createdDecision.id}/paths/${createdPath.id}`,
  );
  const updatedPath = expectSuccessEnvelope(
    updatedPathResponse.payload,
    `PATCH /api/life-decisions/${createdDecision.id}/paths/${createdPath.id}`,
  );

  assert.equal(updatedPath.title, updatePathPayload.title, "updated path title should match");
  assert.equal(updatedPath.description, null, "updated path description should become null");
  assert.deepEqual(updatedPath.benefits, updatePathPayload.benefits, "updated path benefits should match");
  assert.deepEqual(updatedPath.risks, updatePathPayload.risks, "updated path risks should match");
  assert.equal(updatedPath.currentScore, updatePathPayload.currentScore, "updated path currentScore should match");
  logPass("PATCH /api/life-decisions/:decisionId/paths/:pathId updated the path fields");

  const detailAfterPathResponse = await requestJson(`/api/life-decisions/${createdDecision.id}`);
  assertOkStatus(detailAfterPathResponse, `GET /api/life-decisions/${createdDecision.id} after path updates`);
  const detailAfterPath = expectSuccessEnvelope(
    detailAfterPathResponse.payload,
    `GET /api/life-decisions/${createdDecision.id} after path updates`,
  );

  assert.equal(detailAfterPath.paths.length, 1, "life-decision detail should include one created path");
  assert.equal(detailAfterPath.paths[0].id, createdPath.id, "life-decision detail path id should match created path");
  assert.ok(
    Array.isArray(detailAfterPath.paths[0].evidenceItems),
    "life-decision detail path should include evidenceItems array",
  );
  logPass("GET /api/life-decisions/:id reflected the created path");

  const wrongDecisionPathUpdateResponse = await requestJson(
    `/api/life-decisions/${createdSiblingDecision.id}/paths/${createdPath.id}`,
    {
      method: "PATCH",
      body: {
        title: "should-not-work",
      },
    },
  );
  assert.equal(
    wrongDecisionPathUpdateResponse.status,
    404,
    `PATCH path with the wrong decision id should return 404, got ${wrongDecisionPathUpdateResponse.status}`,
  );
  const wrongDecisionPathUpdatePayload = expectErrorEnvelope(
    wrongDecisionPathUpdateResponse.payload,
    "PATCH /api/life-decisions/:wrongDecisionId/paths/:pathId",
  );
  assert.match(
    wrongDecisionPathUpdatePayload.error.message,
    /not found/i,
    "wrong decision path update should mention not found",
  );
  logPass("PATCH path under the wrong decision id returned 404");

  const missingDecisionResponse = await requestJson(`/api/life-decisions/${missingDecisionId}`);
  assert.equal(
    missingDecisionResponse.status,
    404,
    `GET /api/life-decisions/:missingId should return 404, got ${missingDecisionResponse.status}`,
  );
  const missingDecisionPayload = expectErrorEnvelope(
    missingDecisionResponse.payload,
    `GET /api/life-decisions/${missingDecisionId}`,
  );
  assert.match(
    missingDecisionPayload.error.message,
    /not found/i,
    "missing decision fetch should mention not found",
  );
  logPass("GET /api/life-decisions/:id with a missing id returned 404");

  const missingPathResponse = await requestJson(
    `/api/life-decisions/${createdDecision.id}/paths/${missingPathId}`,
    {
      method: "PATCH",
      body: {
        title: "missing-path",
      },
    },
  );
  assert.equal(
    missingPathResponse.status,
    404,
    `PATCH /api/life-decisions/:decisionId/paths/:missingPathId should return 404, got ${missingPathResponse.status}`,
  );
  expectErrorEnvelope(
    missingPathResponse.payload,
    `PATCH /api/life-decisions/${createdDecision.id}/paths/${missingPathId}`,
  );
  logPass("PATCH /api/life-decisions/:decisionId/paths/:pathId with a missing path id returned 404");

  logPass("LifeDecision API verification completed");
} catch (error) {
  logFail(formatError(error));
  process.exitCode = 1;
} finally {
  await stopApiServer(serverProcess);
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

async function ensureApiServer() {
  if (await isApiHealthy()) {
    logStep("Detected an existing API server");
    return null;
  }

  logStep("Starting the built API server for verification");
  const child = spawn(process.execPath, ["--env-file=.env", "apps/api/dist/main.js"], {
    cwd: process.cwd(),
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

async function stopApiServer(child) {
  if (!child) {
    return;
  }

  if (child.exitCode !== null || child.killed) {
    return;
  }

  child.kill("SIGTERM");

  await new Promise((resolve) => {
    child.once("exit", () => resolve(undefined));
    setTimeout(() => {
      if (child.exitCode === null && !child.killed) {
        child.kill("SIGKILL");
      }
      resolve(undefined);
    }, 5_000);
  });
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

function formatError(error) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

function logStep(message) {
  console.log(`[verify:life-decisions] ${message}`);
}

function logPass(message) {
  console.log(`[verify:life-decisions] PASS ${message}`);
}

function logFail(message) {
  console.error(`[verify:life-decisions] FAIL ${message}`);
}
