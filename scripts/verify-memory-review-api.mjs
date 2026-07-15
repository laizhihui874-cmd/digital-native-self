#!/usr/bin/env node

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";
assertIsolatedVerificationRuntime();

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

if (typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env");
}

const requireFromApiWorkspace = createRequire(new URL("../apps/api/package.json", import.meta.url));
const { PrismaClient } = requireFromApiWorkspace("@prisma/client");

const DEFAULT_BASE_URL = "http://localhost:3001";
const DEFAULT_HEALTH_PATH = "/api/health";
const REQUEST_TIMEOUT_MS = 10_000;
const SERVER_BOOT_TIMEOUT_MS = 30_000;

const baseUrl = normalizeBaseUrl(
  process.env.MEMORY_REVIEW_API_BASE_URL ??
    process.env.API_BASE_URL ??
    DEFAULT_BASE_URL,
);
const healthPath = process.env.MEMORY_REVIEW_HEALTH_PATH ?? DEFAULT_HEALTH_PATH;
const suffix = new Date().toISOString().replace(/[:.]/g, "-");
const prisma = new PrismaClient();

let serverProcess = null;

try {
  logStep(`Using base URL: ${baseUrl}`);
  serverProcess = await ensureApiServer();

  const createdResponse = await requestJson("/api/memories", {
    method: "POST",
    body: {
      memoryType: "goal",
      content: `  verify-memory-review-${suffix}  `,
      confidence: 0.82,
      isMomentaryThought: true,
      expiresAt: "2026-07-31T00:00:00.000Z",
    },
  });
  assertOkStatus(createdResponse, "POST /api/memories");
  const createdMemory = expectSuccessEnvelope(createdResponse.payload, "POST /api/memories");

  assert.equal(createdMemory.memoryType, "goal", "memoryType should match create payload");
  assert.equal(createdMemory.content, `verify-memory-review-${suffix}`, "content should be trimmed on create");
  assert.equal(createdMemory.status, "candidate", "create should default status to candidate");
  assert.equal(createdMemory.confidence, 0.82, "confidence should match create payload");
  assert.equal(createdMemory.isMomentaryThought, true, "isMomentaryThought should match create payload");
  assert.equal(createdMemory.expiresAt, "2026-07-31T00:00:00.000Z", "expiresAt should match create payload");
  logPass(`POST /api/memories created candidate id=${createdMemory.id}`);

  const listResponse = await requestJson("/api/memories?status=candidate&memoryType=goal&limit=10&offset=0");
  assertOkStatus(listResponse, "GET /api/memories");
  const listedMemories = expectSuccessEnvelope(listResponse.payload, "GET /api/memories");

  assert.equal(listedMemories.pagination.limit, 10, "list limit should match query");
  assert.equal(listedMemories.pagination.offset, 0, "list offset should match query");
  assert.ok(
    listedMemories.items.some((item) => item.id === createdMemory.id),
    "candidate list should include the created memory",
  );
  logPass("GET /api/memories returned paginated candidate results");

  const detailResponse = await requestJson(`/api/memories/${createdMemory.id}`);
  assertOkStatus(detailResponse, `GET /api/memories/${createdMemory.id}`);
  const detail = expectSuccessEnvelope(detailResponse.payload, `GET /api/memories/${createdMemory.id}`);

  assert.equal(detail.id, createdMemory.id, "detail id should match created id");
  assert.equal(detail.content, createdMemory.content, "detail content should match created content");
  logPass("GET /api/memories/:id returned the created memory");

  const reviewedResponse = await requestJson(`/api/memories/${createdMemory.id}/review`, {
    method: "PATCH",
    body: {
      content: `  confirm-memory-review-${suffix}  `,
      memoryType: "decision",
      status: "confirmed",
      expiresAt: null,
      isMomentaryThought: false,
      changeReason: `manual review ${suffix}`,
    },
  });
  assertOkStatus(reviewedResponse, `PATCH /api/memories/${createdMemory.id}/review`);
  const reviewedMemory = expectSuccessEnvelope(
    reviewedResponse.payload,
    `PATCH /api/memories/${createdMemory.id}/review`,
  );

  assert.equal(reviewedMemory.status, "confirmed", "review should update status");
  assert.equal(reviewedMemory.memoryType, "decision", "review should update memoryType");
  assert.equal(
    reviewedMemory.content,
    `confirm-memory-review-${suffix}`,
    "review should trim and persist updated content",
  );
  assert.equal(reviewedMemory.isMomentaryThought, false, "review should update isMomentaryThought");
  assert.equal(reviewedMemory.expiresAt, null, "review should clear expiresAt when null is provided");
  logPass("PATCH /api/memories/:id/review updated supported fields");

  const versions = await prisma.memoryVersion.findMany({
    where: {
      memoryId: createdMemory.id,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
  assert.equal(versions.length, 1, "content-changing review should create one memory version");
  assert.equal(versions[0].previousContent, createdMemory.content, "memory version should store previous content");
  assert.equal(
    versions[0].newContent,
    reviewedMemory.content,
    "memory version should store updated content",
  );
  assert.equal(versions[0].changeReason, `manual review ${suffix}`, "memory version should store changeReason");
  assert.equal(versions[0].changedBy, "user", "memory version should mark user review");
  logPass("Memory review wrote MemoryVersion history for content changes");

  const secondReviewResponse = await requestJson(`/api/memories/${createdMemory.id}/review`, {
    method: "PATCH",
    body: {
      status: "expired",
      changeReason: `status-only review ${suffix}`,
    },
  });
  assertOkStatus(secondReviewResponse, `PATCH /api/memories/${createdMemory.id}/review status-only`);
  const secondReview = expectSuccessEnvelope(
    secondReviewResponse.payload,
    `PATCH /api/memories/${createdMemory.id}/review status-only`,
  );
  assert.equal(secondReview.status, "expired", "status-only review should update status");

  const versionsAfterStatusOnlyReview = await prisma.memoryVersion.findMany({
    where: {
      memoryId: createdMemory.id,
    },
  });
  assert.equal(
    versionsAfterStatusOnlyReview.length,
    1,
    "status-only review should not create an extra memory version",
  );
  logPass("Status-only review preserved MemoryVersion count");

  const invalidReviewResponse = await requestJson(`/api/memories/${createdMemory.id}/review`, {
    method: "PATCH",
    body: {
      status: "candidate",
    },
  });
  assert.equal(
    invalidReviewResponse.status,
    400,
    `PATCH /api/memories/:id/review with invalid status should return 400, got ${invalidReviewResponse.status}`,
  );
  expectErrorEnvelope(invalidReviewResponse.payload, "PATCH /api/memories/:id/review invalid status");
  logPass("PATCH /api/memories/:id/review rejected invalid status");

  const deleteResponse = await requestJson(`/api/memories/${createdMemory.id}`, {
    method: "DELETE",
  });
  assert.equal(deleteResponse.status, 204, "DELETE /api/memories/:id should return 204");
  assert.equal(deleteResponse.payload, null, "delete response should not include a JSON body");
  logPass("DELETE /api/memories/:id returned 204");

  const deletedDetailResponse = await requestJson(`/api/memories/${createdMemory.id}`);
  assert.equal(deletedDetailResponse.status, 404, "deleted memory detail should return 404");
  expectErrorEnvelope(deletedDetailResponse.payload, "GET /api/memories/:id after delete");
  logPass("GET /api/memories/:id returned 404 after delete");

  logPass("Memory review API verification completed");
} catch (error) {
  logFail(formatError(error));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
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
  console.log(`[verify:memory-review] ${message}`);
}

function logPass(message) {
  console.log(`[verify:memory-review] PASS ${message}`);
}

function logFail(message) {
  console.error(`[verify:memory-review] FAIL ${message}`);
}
