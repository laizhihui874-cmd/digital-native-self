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
  process.env.PROJECT_PACKAGING_SUGGESTIONS_API_BASE_URL ??
    process.env.API_BASE_URL ??
    DEFAULT_BASE_URL,
);
const healthPath = process.env.PROJECT_PACKAGING_SUGGESTIONS_HEALTH_PATH ?? DEFAULT_HEALTH_PATH;
const suffix = new Date().toISOString().replace(/[:.]/g, "-");
const uniqueCandidateKeyword = `CandidateOnlyPackaging-${suffix}`;
const missingProjectId = "22222222-2222-4222-8222-222222222222";
let serverProcess = null;

try {
  logStep(`Using base URL: ${baseUrl}`);
  serverProcess = await ensureApiServer();

  const abilityNode = expectSuccessEnvelope(
    (await requestJson("/api/ability-nodes", {
      method: "POST",
      body: {
        name: `verify-packaging-node-${suffix}`,
      },
    })).payload,
    "POST /api/ability-nodes",
  );

  const confirmedAbilityCandidate = expectSuccessEnvelope(
    (await requestJson("/api/ability-evidence", {
      method: "POST",
      body: {
        abilityNodeId: abilityNode.id,
        content: `完成 AI 应用工程师项目中的需求拆解、接口联调和复盘沉淀 ${suffix}`,
        impact: "positive",
        difficultyScore: 4,
        independenceScore: 4,
        impactScore: 4,
        feedbackScore: 1,
      },
    })).payload,
    "POST /api/ability-evidence confirmed seed",
  );

  const confirmedAbilityEvidence = expectSuccessEnvelope(
    (await requestJson(`/api/ability-evidence/${confirmedAbilityCandidate.id}/review`, {
      method: "PATCH",
      body: {
        status: "confirmed",
      },
    })).payload,
    "PATCH /api/ability-evidence/:id/review",
  );

  await requestOk("/api/ability-evidence", {
    method: "POST",
    body: {
      abilityNodeId: abilityNode.id,
      content: `候选能力证据 ${uniqueCandidateKeyword} 不应进入项目包装建议 ${suffix}`,
      impact: "positive",
      difficultyScore: 4,
      independenceScore: 4,
      impactScore: 4,
      feedbackScore: 1,
    },
  }, "POST /api/ability-evidence candidate ignored seed");
  logPass(`Prepared confirmed and candidate ability evidence under node=${abilityNode.id}`);

  const project = expectSuccessEnvelope(
    (await requestJson("/api/projects", {
      method: "POST",
      body: {
        name: `verify-packaging-project-${suffix}`,
        description: `为个人成长工作台实现项目经历、简历素材和岗位差距分析闭环 ${suffix}`,
        role: "AI 应用工程师",
        status: "completed",
        outcomes: [`完成 3 个后端 API、2 个前端工作区和本地验收脚本 ${suffix}`],
        resumeSummary: `独立推进 AI 应用工程师方向的全栈 MVP 闭环 ${suffix}`,
        abilityEvidenceIds: [confirmedAbilityEvidence.id],
      },
    })).payload,
    "POST /api/projects",
  );
  logPass(`Prepared project id=${project.id}`);

  const confirmedMaterial = expectSuccessEnvelope(
    (await requestJson("/api/resume-materials", {
      method: "POST",
      body: {
        content: `围绕 AI 应用工程师岗位，完成项目经历整理、接口联调和自动化验证 ${suffix}`,
        materialType: "achievement",
        suggestedBullet: `完成项目经历整理、接口联调和自动化验证，形成可复用简历素材 ${suffix}`,
        status: "confirmed",
      },
    })).payload,
    "POST /api/resume-materials confirmed",
  );

  await requestOk("/api/resume-materials", {
    method: "POST",
    body: {
      content: `候选简历素材 ${uniqueCandidateKeyword} 不应进入项目包装建议 ${suffix}`,
      materialType: "skill",
      status: "candidate",
    },
  }, "POST /api/resume-materials candidate ignored seed");
  logPass(`Prepared confirmed and candidate resume materials; confirmed id=${confirmedMaterial.id}`);

  const suggestionResponse = await requestJson("/api/project-packaging-suggestions", {
    method: "POST",
    body: {
      targetRole: "AI 应用工程师",
      targetCompany: "验证公司",
      targetJobDescription: [
        "负责 AI 应用开发、接口联调、自动化验证",
        "能够把项目经历包装成清晰的 STAR 简历表达",
        `不要把 ${uniqueCandidateKeyword} 当成正式证据`,
      ].join("\n"),
      projectId: project.id,
    },
  });
  assertOkStatus(suggestionResponse, "POST /api/project-packaging-suggestions");
  const suggestions = expectSuccessEnvelope(
    suggestionResponse.payload,
    "POST /api/project-packaging-suggestions",
  );

  assert.equal(suggestions.targetRole, "AI 应用工程师", "targetRole should echo trimmed input");
  assert.equal(suggestions.targetCompany, "验证公司", "targetCompany should echo input");
  assert.equal(suggestions.projectId, project.id, "response should be scoped to selected project");
  assert.equal(suggestions.analysisMode, "deterministic", "suggestions should disclose deterministic mode");
  assert.ok(
    suggestions.summary.includes("deterministic") || suggestions.summary.includes("first-pass"),
    "summary should disclose deterministic first-pass boundary",
  );
  assert.ok(
    suggestions.suggestionItems.some((item) => item.category === "resume_star"),
    "suggestions should include a STAR draft item",
  );
  assert.ok(
    suggestions.suggestionItems.some((item) => item.category === "gap_alert"),
    "suggestions should include a gap alert item",
  );
  assert.equal(
    suggestions.evidenceSnapshot.selectedProject?.id,
    project.id,
    "evidence snapshot should include selected project",
  );
  assert.ok(
    suggestions.evidenceSnapshot.confirmedResumeMaterials.some((item) => item.id === confirmedMaterial.id),
    "evidence snapshot should include confirmed resume material",
  );
  assert.ok(
    suggestions.evidenceSnapshot.confirmedAbilityEvidence.some(
      (item) => item.id === confirmedAbilityEvidence.id,
    ),
    "evidence snapshot should include confirmed ability evidence",
  );
  assert.ok(
    !JSON.stringify({
      suggestionItems: suggestions.suggestionItems,
      evidenceSnapshot: suggestions.evidenceSnapshot,
    }).includes(uniqueCandidateKeyword),
    "candidate-only keyword must not appear in suggestions or evidence snapshot",
  );
  assert.ok(
    suggestions.sourceSnapshot.confirmedResumeMaterials >= 1,
    "source snapshot should count confirmed resume materials",
  );
  assert.ok(
    suggestions.sourceSnapshot.confirmedAbilityEvidence >= 1,
    "source snapshot should count confirmed ability evidence",
  );
  logPass("POST /api/project-packaging-suggestions returned deterministic scoped suggestions");

  const genericResponse = await requestJson("/api/project-packaging-suggestions", {
    method: "POST",
    body: {
      targetRole: "AI 应用开发",
    },
  });
  assertOkStatus(genericResponse, "POST /api/project-packaging-suggestions without projectId");
  const genericSuggestions = expectSuccessEnvelope(
    genericResponse.payload,
    "POST /api/project-packaging-suggestions without projectId",
  );
  assert.equal(
    genericSuggestions.analysisMode,
    "deterministic",
    "generic suggestions should still disclose deterministic mode",
  );
  assert.ok(
    Array.isArray(genericSuggestions.suggestionItems) && genericSuggestions.suggestionItems.length > 0,
    "generic suggestions should include at least one suggestion item",
  );
  logPass("POST /api/project-packaging-suggestions works without explicit projectId");

  const missingProjectResponse = await requestJson("/api/project-packaging-suggestions", {
    method: "POST",
    body: {
      targetRole: "AI 应用工程师",
      projectId: missingProjectId,
    },
  });
  assert.equal(missingProjectResponse.status, 404, "missing projectId should return 404");
  expectErrorEnvelope(missingProjectResponse.payload, "POST /api/project-packaging-suggestions missing project");
  logPass("POST /api/project-packaging-suggestions rejected missing projectId");

  const invalidRoleResponse = await requestJson("/api/project-packaging-suggestions", {
    method: "POST",
    body: {
      targetRole: "   ",
    },
  });
  assert.equal(invalidRoleResponse.status, 400, "empty targetRole should return 400");
  expectErrorEnvelope(invalidRoleResponse.payload, "POST /api/project-packaging-suggestions empty role");
  logPass("POST /api/project-packaging-suggestions rejected empty targetRole");

  logPass("ProjectPackagingSuggestions API verification completed");
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
      signal: AbortSignal.timeout(2_000),
    });

    return response.ok;
  } catch {
    return false;
  }
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

async function requestOk(pathname, options, label) {
  const response = await requestJson(pathname, options);
  assertOkStatus(response, label);
  return expectSuccessEnvelope(response.payload, label);
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
  console.log(`[verify:project-packaging-suggestions] ${message}`);
}

function logPass(message) {
  console.log(`[verify:project-packaging-suggestions] PASS ${message}`);
}

function logFail(message) {
  console.error(`[verify:project-packaging-suggestions] FAIL ${message}`);
}
