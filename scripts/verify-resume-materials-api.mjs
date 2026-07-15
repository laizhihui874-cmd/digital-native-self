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
  process.env.RESUME_MATERIALS_API_BASE_URL ?? process.env.API_BASE_URL ?? DEFAULT_BASE_URL,
);
const healthPath = process.env.RESUME_MATERIALS_HEALTH_PATH ?? DEFAULT_HEALTH_PATH;
const suffix = new Date().toISOString().replace(/[:.]/g, "-");
const missingProjectId = "11111111-1111-4111-8111-111111111111";

let serverProcess = null;

try {
  logStep(`Using base URL: ${baseUrl}`);
  serverProcess = await ensureApiServer();

  const projectCountBefore = await getProjectTotal();

  const abilityNode = expectSuccessEnvelope(
    (await requestJson("/api/ability-nodes", {
      method: "POST",
      body: {
        name: `verify-resume-material-node-${suffix}`,
        description: "resume material extraction verification node",
      },
    })).payload,
    "POST /api/ability-nodes",
  );

  const abilityEvidenceCandidate = expectSuccessEnvelope(
    (await requestJson("/api/ability-evidence", {
      method: "POST",
      body: {
        abilityNodeId: abilityNode.id,
        content: `完成会议预约 skill 的接口调试与异常返回核验 ${suffix}`,
        impact: "positive",
        difficultyScore: 4,
        independenceScore: 4,
        impactScore: 5,
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
  assert.equal(confirmedAbilityEvidence.status, "confirmed", "seed ability evidence should be confirmed");
  logPass(`Prepared confirmed ability evidence id=${confirmedAbilityEvidence.id}`);

  const project = expectSuccessEnvelope(
    (await requestJson("/api/projects", {
      method: "POST",
      body: {
        name: `verify-resume-material-project-${suffix}`,
        description: `为 OpenClaw 平台选型沉淀可复用调研框架 ${suffix}`,
        role: "AI 应用工程师",
        status: "active",
        outcomes: [
          `输出平台选型对比维度 ${suffix}`,
          `验证聊天平台接入 openclaw 的关键限制 ${suffix}`,
        ],
        resumeSummary: `调研并对比 AI 协作平台能力，形成选型建议 ${suffix}`,
        abilityEvidenceIds: [confirmedAbilityEvidence.id],
      },
    })).payload,
    "POST /api/projects",
  );
  logPass(`Prepared project id=${project.id}`);

  const resumeDocument = expectSuccessEnvelope(
    (await requestJson("/api/resume-documents/text", {
      method: "POST",
      body: {
        title: `verify-resume-material-resume-${suffix}`,
        content: [
          `- 搭建会议预约 skill 并完成基础 API 测试 ${suffix}`,
          `- 调研 OpenClaw 与聊天平台集成路径 ${suffix}`,
        ].join("\n"),
      },
    })).payload,
    "POST /api/resume-documents/text",
  );
  logPass(`Prepared resume document id=${resumeDocument.id}`);

  const dailyEntry = expectSuccessEnvelope(
    (await requestJson("/api/daily-entries", {
      method: "POST",
      body: {
        rawContent: `今天推进了接口测试和平台调研，也记录了沟通压力 ${suffix}`,
      },
    })).payload,
    "POST /api/daily-entries",
  );

  await requestOk("/api/structured-daily-reports", {
    method: "POST",
    body: {
      dailyEntryId: dailyEntry.id,
      facts: [{ title: "事实", detail: `完成简历素材验收数据准备 ${suffix}` }],
      emotions: [{ title: "情绪", detail: "有压力但能拆分处理" }],
      workItems: [{ title: "工作项", detail: `验证候选素材接口闭环 ${suffix}` }],
      feedback: [{ title: "反馈", detail: "需要把候选与正式档案分开" }],
      growthEvidence: [{ title: "成长证据", detail: `能将记录转为可复盘证据 ${suffix}` }],
      drainSources: [{ title: "消耗", detail: "重复回归容易遗漏状态边界" }],
      nextActions: [{ title: "下一步", detail: "接入前端候选素材确认区" }],
      decisionImpact: [{ title: "决策影响", detail: "简历素材候选不等同于自动包装" }],
    },
  }, "POST /api/structured-daily-reports");
  logPass(`Prepared structured daily report for dailyEntry id=${dailyEntry.id}`);

  const projectCountAfterSeed = await getProjectTotal();
  assert.equal(
    projectCountAfterSeed,
    projectCountBefore + 1,
    "seeding should create exactly one project before extraction",
  );

  const extractResponse = await requestJson("/api/resume-materials/extract-candidates", {
    method: "POST",
    body: {
      limitPerSource: 2,
    },
  });
  assertOkStatus(extractResponse, "POST /api/resume-materials/extract-candidates");
  const extraction = expectSuccessEnvelope(
    extractResponse.payload,
    "POST /api/resume-materials/extract-candidates",
  );

  assert.ok(Array.isArray(extraction.created), "extract response should include created array");
  assert.ok(extraction.scanned.abilityEvidence >= 1, "extract should scan ability evidence");
  assert.ok(extraction.scanned.projects >= 1, "extract should scan projects");
  assert.ok(extraction.scanned.resumeDocuments >= 1, "extract should scan resume documents");
  assert.ok(extraction.scanned.dailyEntries >= 1, "extract should scan daily entries");
  assert.ok(
    extraction.created.every((item) => item.status === "candidate"),
    "all extracted materials should default to candidate",
  );
  assert.ok(
    extraction.created.every((item) => item.confidence === null),
    "deterministic extraction should not fake confidence",
  );
  logPass(`POST /api/resume-materials/extract-candidates created ${extraction.created.length} candidates`);

  const projectCountAfterExtraction = await getProjectTotal();
  assert.equal(
    projectCountAfterExtraction,
    projectCountAfterSeed,
    "candidate extraction must not auto-create Project records",
  );
  logPass("Candidate extraction did not create additional projects");

  const seededMaterials = await collectSeededMaterials({
    abilityEvidenceId: confirmedAbilityEvidence.id,
    projectId: project.id,
    resumeDocumentId: resumeDocument.id,
    dailyEntryId: dailyEntry.id,
  });

  assert.ok(
    seededMaterials.abilityEvidence.some((item) => item.materialType === "skill"),
    "confirmed ability evidence should create a skill material candidate",
  );
  assert.ok(
    seededMaterials.abilityEvidence.some((item) => item.materialType === "achievement"),
    "positive confirmed ability evidence should create an achievement material candidate",
  );
  assert.ok(
    seededMaterials.project.some((item) => item.materialType === "project_summary"),
    "project should create project_summary material candidates",
  );
  assert.ok(
    seededMaterials.resumeDocument.some((item) => item.materialType === "other"),
    "resume document lines should create other material candidates",
  );
  assert.ok(
    seededMaterials.dailyEntry.some((item) => item.materialType === "reflection"),
    "daily growth evidence should create reflection material candidates",
  );
  assert.ok(
    seededMaterials.dailyEntry.some((item) => item.materialType === "responsibility"),
    "daily work items should create responsibility material candidates",
  );
  logPass("Extracted candidates exist for all seeded source types");

  const secondExtractResponse = await requestJson("/api/resume-materials/extract-candidates", {
    method: "POST",
    body: {
      limitPerSource: 2,
    },
  });
  assertOkStatus(secondExtractResponse, "POST /api/resume-materials/extract-candidates idempotent");
  const secondExtraction = expectSuccessEnvelope(
    secondExtractResponse.payload,
    "POST /api/resume-materials/extract-candidates idempotent",
  );
  assert.equal(
    secondExtraction.created.length,
    0,
    "second extraction should not recreate existing deterministic candidates",
  );
  assert.ok(
    secondExtraction.skippedCount >= extraction.created.length,
    "second extraction should report skipped existing candidates",
  );
  logPass("Candidate extraction is idempotent for existing source/content/type keys");

  const candidateList = expectSuccessEnvelope(
    (await requestJson("/api/resume-materials?status=candidate&limit=100&offset=0")).payload,
    "GET /api/resume-materials candidate list",
  );
  assert.equal(candidateList.pagination.limit, 100, "candidate list should echo limit");
  assert.ok(
    candidateList.items.every((item) => item.status === "candidate"),
    "candidate list should only include candidate materials",
  );
  assert.ok(
    seededMaterials.project.some((item) => item.id === seededMaterials.project[0].id),
    "source-scoped pagination should include seeded project material",
  );
  logPass("GET /api/resume-materials returned candidate list and source-scoped seeded material");

  const detail = expectSuccessEnvelope(
    (await requestJson(`/api/resume-materials/${seededMaterials.project[0].id}`)).payload,
    "GET /api/resume-materials/:id",
  );
  assert.equal(detail.id, seededMaterials.project[0].id, "detail should return requested material");
  logPass("GET /api/resume-materials/:id returned material detail");

  const confirmedMaterial = expectSuccessEnvelope(
    (await requestJson(`/api/resume-materials/${seededMaterials.project[0].id}/review`, {
      method: "PATCH",
      body: {
        status: "confirmed",
        content: `确认后的项目简历素材 ${suffix}`,
        suggestedBullet: `确认后 bullet ${suffix}`,
        materialType: "achievement",
      },
    })).payload,
    "PATCH /api/resume-materials/:id/review confirmed",
  );
  assert.equal(confirmedMaterial.status, "confirmed", "review should confirm material");
  assert.equal(confirmedMaterial.content, `确认后的项目简历素材 ${suffix}`, "review should update content");
  assert.equal(confirmedMaterial.suggestedBullet, `确认后 bullet ${suffix}`, "review should update bullet");
  assert.equal(confirmedMaterial.materialType, "achievement", "review should update materialType");
  logPass("PATCH /api/resume-materials/:id/review confirmed with edits");

  const rejectedMaterial = expectSuccessEnvelope(
    (await requestJson(`/api/resume-materials/${seededMaterials.resumeDocument[0].id}/review`, {
      method: "PATCH",
      body: {
        status: "rejected",
        suggestedBullet: "   ",
      },
    })).payload,
    "PATCH /api/resume-materials/:id/review rejected",
  );
  assert.equal(rejectedMaterial.status, "rejected", "review should reject material");
  assert.equal(rejectedMaterial.suggestedBullet, null, "blank suggestedBullet should normalize to null");
  logPass("PATCH /api/resume-materials/:id/review rejected candidate");

  const manualMaterialResponse = await requestJson("/api/resume-materials", {
    method: "POST",
    body: {
      content: `手动补充的简历素材 ${suffix}`,
      materialType: "skill",
      suggestedBullet: `手动 bullet ${suffix}`,
      confidence: 0.7,
    },
  });
  assertOkStatus(manualMaterialResponse, "POST /api/resume-materials manual");
  const manualMaterial = expectSuccessEnvelope(
    manualMaterialResponse.payload,
    "POST /api/resume-materials manual",
  );
  assert.equal(manualMaterial.sourceType, "manual", "manual create should default sourceType to manual");
  assert.equal(manualMaterial.sourceId, null, "manual create should store sourceId as null");
  assert.equal(manualMaterial.status, "candidate", "manual create should default status to candidate");
  assert.equal(manualMaterial.confidence, 0.7, "manual create should preserve confidence");
  logPass(`POST /api/resume-materials created manual material id=${manualMaterial.id}`);

  const invalidSourceResponse = await requestJson("/api/resume-materials", {
    method: "POST",
    body: {
      sourceType: "project",
      sourceId: missingProjectId,
      content: `missing project material ${suffix}`,
    },
  });
  assert.equal(invalidSourceResponse.status, 404, "missing source should return 404");
  expectErrorEnvelope(invalidSourceResponse.payload, "POST /api/resume-materials missing source");
  logPass("POST /api/resume-materials rejected missing non-manual source with 404");

  const invalidConfidenceResponse = await requestJson("/api/resume-materials", {
    method: "POST",
    body: {
      content: `invalid confidence material ${suffix}`,
      confidence: 1.2,
    },
  });
  assert.equal(invalidConfidenceResponse.status, 400, "invalid confidence should return 400");
  expectErrorEnvelope(invalidConfidenceResponse.payload, "POST /api/resume-materials invalid confidence");
  logPass("POST /api/resume-materials rejected confidence outside 0..1");

  const invalidExtractResponse = await requestJson("/api/resume-materials/extract-candidates", {
    method: "POST",
    body: {
      limitPerSource: 11,
    },
  });
  assert.equal(invalidExtractResponse.status, 400, "invalid limitPerSource should return 400");
  expectErrorEnvelope(
    invalidExtractResponse.payload,
    "POST /api/resume-materials/extract-candidates invalid limit",
  );
  logPass("POST /api/resume-materials/extract-candidates rejected invalid limitPerSource");

  const deleteResponse = await requestJson(`/api/resume-materials/${manualMaterial.id}`, {
    method: "DELETE",
  });
  assert.equal(deleteResponse.status, 204, "DELETE /api/resume-materials/:id should return 204");
  assert.equal(deleteResponse.payload, null, "204 delete response should not include a JSON payload");
  logPass("DELETE /api/resume-materials/:id returned 204");

  const deletedDetailResponse = await requestJson(`/api/resume-materials/${manualMaterial.id}`);
  assert.equal(deletedDetailResponse.status, 404, "deleted material detail should return 404");
  expectErrorEnvelope(deletedDetailResponse.payload, "GET /api/resume-materials/:id after delete");
  logPass("GET /api/resume-materials/:id returned 404 after delete");

  logPass("ResumeMaterial API verification completed");
} catch (error) {
  logFail(formatError(error));
  process.exitCode = 1;
} finally {
  await stopApiServer(serverProcess);
}

async function collectSeededMaterials({
  abilityEvidenceId,
  projectId,
  resumeDocumentId,
  dailyEntryId,
}) {
  const [abilityEvidence, project, resumeDocument, dailyEntry] = await Promise.all([
    listBySourceType("ability_evidence"),
    listBySourceType("project"),
    listBySourceType("resume_document"),
    listBySourceType("daily_entry"),
  ]);

  return {
    abilityEvidence: abilityEvidence.filter((item) => item.sourceId === abilityEvidenceId),
    project: project.filter((item) => item.sourceId === projectId),
    resumeDocument: resumeDocument.filter((item) => item.sourceId === resumeDocumentId),
    dailyEntry: dailyEntry.filter((item) => item.sourceId === dailyEntryId),
  };
}

async function listBySourceType(sourceType) {
  const limit = 100;
  const items = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const response = await requestJson(
      `/api/resume-materials?sourceType=${sourceType}&limit=${limit}&offset=${offset}`,
    );
    assertOkStatus(response, `GET /api/resume-materials?sourceType=${sourceType}`);
    const payload = expectSuccessEnvelope(
      response.payload,
      `GET /api/resume-materials?sourceType=${sourceType}`,
    );

    items.push(...payload.items);
    total = payload.pagination.total;
    offset += limit;
  }

  return items;
}

async function getProjectTotal() {
  const response = await requestJson("/api/projects?limit=1&offset=0");
  assertOkStatus(response, "GET /api/projects total");
  const payload = expectSuccessEnvelope(response.payload, "GET /api/projects total");
  return payload.pagination.total;
}

async function requestOk(pathname, options, label) {
  const response = await requestJson(pathname, options);
  assertOkStatus(response, label);
  return expectSuccessEnvelope(response.payload, label);
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

function formatError(error) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

function logStep(message) {
  console.log(`[verify:resume-materials] ${message}`);
}

function logPass(message) {
  console.log(`[verify:resume-materials] PASS ${message}`);
}

function logFail(message) {
  console.error(`[verify:resume-materials] FAIL ${message}`);
}
