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

const baseUrl = normalizeBaseUrl(
  process.env.PROJECTS_API_BASE_URL ?? process.env.API_BASE_URL ?? DEFAULT_BASE_URL,
);
const healthPath = process.env.PROJECTS_HEALTH_PATH ?? DEFAULT_HEALTH_PATH;
const suffix = new Date().toISOString().replace(/[:.]/g, "-");
const missingAbilityEvidenceId = "11111111-1111-4111-8111-111111111111";
let serverProcess = null;

try {
  logStep(`Using base URL: ${baseUrl}`);
  serverProcess = await ensureApiServer();

  const abilityNode = expectSuccessEnvelope(
    (await requestJson("/api/ability-nodes", {
      method: "POST",
      body: {
        name: `verify-project-node-${suffix}`,
      },
    })).payload,
    "POST /api/ability-nodes",
  );

  const abilityEvidence = expectSuccessEnvelope(
    (await requestJson("/api/ability-evidence", {
      method: "POST",
      body: {
        abilityNodeId: abilityNode.id,
        content: `project evidence ${suffix}`,
        impact: "positive",
        difficultyScore: 4,
        independenceScore: 4,
        impactScore: 5,
        feedbackScore: 1,
      },
    })).payload,
    "POST /api/ability-evidence",
  );
  logPass(`Prepared ability evidence id=${abilityEvidence.id}`);

  const createdProjectResponse = await requestJson("/api/projects", {
    method: "POST",
    body: {
      name: `  verify-project-${suffix}  `,
      description: `  项目描述 ${suffix}  `,
      role: "  AI 应用工程师  ",
      startDate: "2026-06-01T00:00:00.000Z",
      endDate: "2026-06-19T00:00:00.000Z",
      status: "active",
      outcomes: ["  完成会议预约 skill  ", "", "调研 OpenClaw 协作平台"],
      resumeSummary: `  简历摘要 ${suffix}  `,
      abilityEvidenceIds: [abilityEvidence.id],
    },
  });
  assertOkStatus(createdProjectResponse, "POST /api/projects");
  const createdProject = expectSuccessEnvelope(createdProjectResponse.payload, "POST /api/projects");

  assert.equal(createdProject.name, `verify-project-${suffix}`, "project name should be trimmed");
  assert.equal(createdProject.description, `项目描述 ${suffix}`, "project description should be trimmed");
  assert.equal(createdProject.role, "AI 应用工程师", "project role should be trimmed");
  assert.deepEqual(
    createdProject.outcomes,
    ["完成会议预约 skill", "调研 OpenClaw 协作平台"],
    "project outcomes should be trimmed and empty outcomes removed",
  );
  assert.equal(createdProject.status, "active", "project status should match");
  logPass(`POST /api/projects created id=${createdProject.id}`);

  const listResponse = await requestJson("/api/projects?status=active&limit=10&offset=0");
  assertOkStatus(listResponse, "GET /api/projects");
  const listedProjects = expectSuccessEnvelope(listResponse.payload, "GET /api/projects");
  assert.equal(listedProjects.pagination.limit, 10, "project list limit should match");
  assert.equal(listedProjects.pagination.offset, 0, "project list offset should match");
  assert.ok(
    listedProjects.items.some((item) => item.id === createdProject.id),
    "project list should include created project",
  );
  logPass("GET /api/projects returned filtered project list");

  const detailResponse = await requestJson(`/api/projects/${createdProject.id}`);
  assertOkStatus(detailResponse, "GET /api/projects/:id");
  const detail = expectSuccessEnvelope(detailResponse.payload, "GET /api/projects/:id");
  assert.equal(detail.id, createdProject.id, "project detail id should match");
  assert.deepEqual(
    detail.abilityEvidenceItems.map((item) => item.id),
    [abilityEvidence.id],
    "project detail should include linked ability evidence ids",
  );
  assert.equal(
    detail.abilityEvidenceItems[0]?.content,
    abilityEvidence.content,
    "project detail should include linked ability evidence content",
  );
  assert.equal(
    detail.abilityEvidenceItems[0]?.abilityNodeId,
    abilityEvidence.abilityNodeId,
    "project detail should include linked ability evidence fields",
  );
  logPass("GET /api/projects/:id returned created project");

  const updatedProjectResponse = await requestJson(`/api/projects/${createdProject.id}`, {
    method: "PATCH",
    body: {
      status: "completed",
      outcomes: ["  形成可复用项目叙事  "],
      resumeSummary: `更新后的简历摘要 ${suffix}`,
      abilityEvidenceIds: [],
    },
  });
  assertOkStatus(updatedProjectResponse, "PATCH /api/projects/:id");
  const updatedProject = expectSuccessEnvelope(updatedProjectResponse.payload, "PATCH /api/projects/:id");
  assert.equal(updatedProject.status, "completed", "project status should update");
  assert.deepEqual(updatedProject.outcomes, ["形成可复用项目叙事"], "project outcomes should update");
  assert.equal(
    updatedProject.resumeSummary,
    `更新后的简历摘要 ${suffix}`,
    "project resume summary should update",
  );
  logPass("PATCH /api/projects/:id updated supported fields");

  const clearedDetailResponse = await requestJson(`/api/projects/${createdProject.id}`);
  assertOkStatus(clearedDetailResponse, "GET /api/projects/:id after PATCH");
  const clearedDetail = expectSuccessEnvelope(
    clearedDetailResponse.payload,
    "GET /api/projects/:id after PATCH",
  );
  assert.deepEqual(
    clearedDetail.abilityEvidenceItems,
    [],
    "project detail should clear linked ability evidence after PATCH abilityEvidenceIds=[]",
  );
  logPass("GET /api/projects/:id returned empty ability evidence after clearing links");

  const invalidDateResponse = await requestJson("/api/projects", {
    method: "POST",
    body: {
      name: `invalid-date-project-${suffix}`,
      startDate: "2026-07-01T00:00:00.000Z",
      endDate: "2026-06-01T00:00:00.000Z",
    },
  });
  assert.equal(invalidDateResponse.status, 400, "invalid date range should return 400");
  expectErrorEnvelope(invalidDateResponse.payload, "POST /api/projects invalid date");
  logPass("POST /api/projects rejected invalid date range");

  const missingEvidenceResponse = await requestJson("/api/projects", {
    method: "POST",
    body: {
      name: `missing-evidence-project-${suffix}`,
      abilityEvidenceIds: [missingAbilityEvidenceId],
    },
  });
  assert.equal(missingEvidenceResponse.status, 404, "missing ability evidence should return 404");
  expectErrorEnvelope(missingEvidenceResponse.payload, "POST /api/projects missing ability evidence");
  logPass("POST /api/projects rejected missing ability evidence id");

  const deleteResponse = await requestJson(`/api/projects/${createdProject.id}`, {
    method: "DELETE",
  });
  assert.equal(deleteResponse.status, 204, "DELETE /api/projects/:id should return 204");
  assert.equal(deleteResponse.payload, null, "204 delete response should not include a JSON body");
  logPass("DELETE /api/projects/:id returned 204");

  const deletedDetailResponse = await requestJson(`/api/projects/${createdProject.id}`);
  assert.equal(deletedDetailResponse.status, 404, "deleted project should return 404");
  expectErrorEnvelope(deletedDetailResponse.payload, "GET /api/projects/:id after delete");
  logPass("GET /api/projects/:id returned 404 after delete");

  logPass("Projects API verification completed");
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
      signal: AbortSignal.timeout(1_000),
    });

    return response.ok;
  } catch {
    return false;
  }
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

  return payload;
}

function formatError(error) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

function logStep(message) {
  console.log(`[verify:projects] ${message}`);
}

function logPass(message) {
  console.log(`[verify:projects] PASS ${message}`);
}

function logFail(message) {
  console.error(`[verify:projects] FAIL ${message}`);
}
