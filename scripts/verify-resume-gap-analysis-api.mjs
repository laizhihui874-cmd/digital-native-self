#!/usr/bin/env node

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";
assertIsolatedVerificationRuntime();

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const DEFAULT_BASE_URL = "http://localhost:3001";
const DEFAULT_HEALTH_PATH = "/api/health";
const REQUEST_TIMEOUT_MS = 10_000;
const SERVER_BOOT_TIMEOUT_MS = 30_000;

const explicitBaseUrl = process.env.RESUME_GAP_ANALYSIS_API_BASE_URL ?? process.env.API_BASE_URL;
const requestedBaseUrl = normalizeBaseUrl(explicitBaseUrl ?? DEFAULT_BASE_URL);
const healthPath = process.env.RESUME_GAP_ANALYSIS_HEALTH_PATH ?? DEFAULT_HEALTH_PATH;
const suffix = new Date().toISOString().replace(/[:.]/g, "-");
const uniqueGapKeyword = `FoobarQZ-${suffix}`;

let baseUrl = requestedBaseUrl;
let serverProcess = null;

try {
  logStep(`Requested base URL: ${requestedBaseUrl}`);
  serverProcess = await ensureApiServer();

  const abilityNode = expectSuccessEnvelope(
    (await requestJson("/api/ability-nodes", {
      method: "POST",
      body: {
        name: `verify-gap-analysis-node-${suffix}`,
      },
    })).payload,
    "POST /api/ability-nodes",
  );

  const abilityEvidenceCandidate = expectSuccessEnvelope(
    (await requestJson("/api/ability-evidence", {
      method: "POST",
      body: {
        abilityNodeId: abilityNode.id,
        content: `能完成需求拆解、沟通表达和接口联调复盘 ${suffix}`,
        impact: "positive",
        difficultyScore: 4,
        independenceScore: 4,
        impactScore: 4,
        feedbackScore: 1,
      },
    })).payload,
    "POST /api/ability-evidence",
  );

  const confirmedAbilityEvidence = expectSuccessEnvelope(
    (await requestJson(`/api/ability-evidence/${abilityEvidenceCandidate.id}/review`, {
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
      content: `候选证据包含 ${uniqueGapKeyword}，但未确认前不应进入差距分析匹配 ${suffix}`,
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
        name: `verify-gap-analysis-project-${suffix}`,
        description: `负责 AI 应用开发、OpenAI API 接入和 Agent 工具链搭建 ${suffix}`,
        role: "AI 应用工程师",
        status: "active",
        outcomes: [`完成接口联调和错误处理 ${suffix}`],
        resumeSummary: `围绕 AI 应用开发沉淀可写入简历的项目表达 ${suffix}`,
        abilityEvidenceIds: [confirmedAbilityEvidence.id],
      },
    })).payload,
    "POST /api/projects",
  );
  logPass(`Prepared project id=${project.id}`);

  await requestOk("/api/resume-documents/text", {
    method: "POST",
    body: {
      title: `verify-gap-analysis-resume-${suffix}`,
      content: `简历原文：AI 应用开发、接口联调、自动化验证、需求拆解 ${suffix}`,
    },
  }, "POST /api/resume-documents/text");

  const confirmedMaterial = expectSuccessEnvelope(
    (await requestJson("/api/resume-materials", {
      method: "POST",
      body: {
        content: `OpenAI API 接入、Agent 工具链搭建和自动化验证 ${suffix}`,
        materialType: "achievement",
        suggestedBullet: `完成 OpenAI API 接入与 Agent 工具链搭建 ${suffix}`,
        status: "confirmed",
      },
    })).payload,
    "POST /api/resume-materials confirmed",
  );

  await requestOk("/api/resume-materials", {
    method: "POST",
    body: {
      content: `候选素材包含 ${uniqueGapKeyword}，但 candidate 不应被分析视为匹配证据 ${suffix}`,
      materialType: "skill",
      status: "candidate",
    },
  }, "POST /api/resume-materials candidate ignored seed");
  logPass(`Prepared confirmed resume material id=${confirmedMaterial.id}`);

  await requestOk("/api/external-sources", {
    method: "POST",
    body: {
      title: `verify-gap-analysis-jd-source-${suffix}`,
      sourceSite: "Smoke JD",
      url: "https://example.com/resume-gap-analysis",
      summary: `AI 应用工程师岗位要求 OpenAI API 接入、需求拆解和沟通协作 ${suffix}`,
    },
  }, "POST /api/external-sources");

  const jobDescription = [
    "1. 负责 OpenAI API 接入和 Agent 工具链搭建",
    "2. 具备需求拆解、沟通表达和接口联调能力",
    `3. 熟悉 ${uniqueGapKeyword} 量子投递编排`,
  ].join("\n");

  const analysisResponse = await requestJson("/api/resume-gap-analysis", {
    method: "POST",
    body: {
      targetRole: "AI 应用工程师",
      targetCompany: "验证公司",
      targetJobDescription: jobDescription,
    },
  });
  assertOkStatus(analysisResponse, "POST /api/resume-gap-analysis");
  const analysis = expectSuccessEnvelope(analysisResponse.payload, "POST /api/resume-gap-analysis");

  assert.equal(analysis.targetRole, "AI 应用工程师", "targetRole should echo trimmed input");
  assert.equal(analysis.targetCompany, "验证公司", "targetCompany should echo input");
  assert.equal(analysis.analysisMode, "deterministic", "analysis should disclose deterministic mode");
  assert.ok(
    analysis.summary.includes("规则匹配") || analysis.summary.includes("初步差距分析"),
    "summary should disclose first-pass deterministic analysis",
  );
  assert.equal(analysis.requirementItems.length, 3, "JD lines should produce three requirements");
  assert.ok(
    analysis.requirementItems.every((item) => item.source === "jd"),
    "requirements should be sourced from JD when JD is provided",
  );
  assert.ok(
    analysis.matchedEvidence.some(
      (item) =>
        item.requirementText.includes("OpenAI") &&
        ["project", "resume_document", "resume_material", "external_source"].includes(item.evidenceType),
    ),
    "OpenAI requirement should match existing confirmed project/resume evidence",
  );
  assert.ok(
    analysis.matchedEvidence.some(
      (item) =>
        item.requirementText.includes("需求拆解") &&
        item.evidenceType === "ability_evidence" &&
        item.evidenceId === confirmedAbilityEvidence.id,
    ),
    "communication/requirement breakdown should match confirmed ability evidence",
  );
  assert.ok(
    analysis.gapItems.some((item) => item.requirementText.includes(uniqueGapKeyword)),
    "unique candidate-only requirement should stay in gapItems",
  );
  assert.ok(
    !analysis.matchedEvidence.some((item) => item.content.includes(uniqueGapKeyword)),
    "candidate-only keyword must not appear in matched evidence",
  );
  assert.ok(
    analysis.sourceSnapshot.confirmedResumeMaterials >= 1,
    "source snapshot should count confirmed resume materials",
  );
  assert.ok(
    analysis.sourceSnapshot.confirmedAbilityEvidence >= 1,
    "source snapshot should count confirmed ability evidence",
  );
  assert.ok(
    Array.isArray(analysis.actionSuggestions) && analysis.actionSuggestions.length > 0,
    "analysis should include action suggestions",
  );
  logPass("POST /api/resume-gap-analysis returned deterministic JD-based analysis");

  const templateResponse = await requestJson("/api/resume-gap-analysis", {
    method: "POST",
    body: {
      targetRole: "AI 应用开发",
    },
  });
  assertOkStatus(templateResponse, "POST /api/resume-gap-analysis role template");
  const templateAnalysis = expectSuccessEnvelope(
    templateResponse.payload,
    "POST /api/resume-gap-analysis role template",
  );
  assert.ok(
    templateAnalysis.requirementItems.every((item) => item.source === "role_template"),
    "missing JD should fall back to role template requirements",
  );
  logPass("POST /api/resume-gap-analysis falls back to target-role template without JD");

  const invalidRoleResponse = await requestJson("/api/resume-gap-analysis", {
    method: "POST",
    body: {
      targetRole: "   ",
    },
  });
  assert.equal(invalidRoleResponse.status, 400, "empty targetRole should return 400");
  expectErrorEnvelope(invalidRoleResponse.payload, "POST /api/resume-gap-analysis empty targetRole");
  logPass("POST /api/resume-gap-analysis rejected empty targetRole");

  logPass("ResumeGapAnalysis API verification completed");
} catch (error) {
  logFail(formatError(error));
  process.exitCode = 1;
} finally {
  await stopApiServer(serverProcess);
}

async function ensureApiServer() {
  if (explicitBaseUrl) {
    if (await isApiHealthy(requestedBaseUrl)) {
      baseUrl = requestedBaseUrl;
      logStep("Detected an existing API server at the explicit override URL");
      return null;
    }

    const explicitUrl = new URL(requestedBaseUrl);
    if (!isLocalHostname(explicitUrl.hostname)) {
      throw new Error(`Explicit API override ${requestedBaseUrl} is not healthy.`);
    }

    baseUrl = requestedBaseUrl;
    return startManagedApi(explicitUrl.port.length > 0 ? Number(explicitUrl.port) : 3001);
  }

  if (await isApiHealthy(requestedBaseUrl)) {
    logStep(
      `Detected an existing API server at ${requestedBaseUrl}; starting an isolated verification API instead of reusing it.`,
    );
  }

  const managedPort = await findAvailablePort();
  baseUrl = `http://127.0.0.1:${managedPort}`;
  return startManagedApi(managedPort);
}

async function startManagedApi(port) {
  logStep(`Starting the built API server on port ${port} for verification`);
  const child = spawn(process.execPath, ["--env-file=.env", "apps/api/dist/main.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      STRUCTURED_REPORT_GENERATOR_PROVIDER:
        process.env.STRUCTURED_REPORT_GENERATOR_PROVIDER ?? "fake",
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

async function isApiHealthy(url = baseUrl) {
  try {
    const response = await fetch(`${url}${healthPath}`, {
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

async function findAvailablePort() {
  const server = net.createServer();

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(undefined));
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise((resolve) => server.close(() => resolve(undefined)));
    throw new Error("Failed to resolve an available local TCP port.");
  }

  const { port } = address;
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(undefined);
    });
  });

  return port;
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
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
  console.log(`[verify:resume-gap-analysis] ${message}`);
}

function logPass(message) {
  console.log(`[verify:resume-gap-analysis] PASS ${message}`);
}

function logFail(message) {
  console.error(`[verify:resume-gap-analysis] FAIL ${message}`);
}
