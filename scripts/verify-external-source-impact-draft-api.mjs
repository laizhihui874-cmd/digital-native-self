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
  process.env.EXTERNAL_SOURCE_IMPACT_DRAFT_API_BASE_URL ??
    process.env.API_BASE_URL ??
    DEFAULT_BASE_URL,
);
const healthPath = process.env.EXTERNAL_SOURCE_IMPACT_DRAFT_HEALTH_PATH ?? DEFAULT_HEALTH_PATH;
const suffix = new Date().toISOString().replace(/[:.]/g, "-");
const missingDecisionId = "44444444-4444-4444-8444-444444444444";
const prisma = new PrismaClient();
let serverProcess = null;

try {
  logStep(`Using base URL: ${baseUrl}`);
  serverProcess = await ensureApiServer();

  const decision = expectSuccessEnvelope(
    (
      await requestJson("/api/life-decisions", {
        method: "POST",
        body: {
          title: `verify-external-impact-${suffix}`,
          description: "用于验证外部信息只生成候选影响草稿，不自动写入正式证据。",
          status: "active",
        },
      })
    ).payload,
    "POST /api/life-decisions",
  );

  const workPath = expectSuccessEnvelope(
    (
      await requestJson(`/api/life-decisions/${decision.id}/paths`, {
        method: "POST",
        body: {
          title: "继续工作并积累 AI 应用项目",
          description: "观察岗位要求、项目经历和成长性。",
          benefits: ["积累 AI 应用开发项目", "保留现金流"],
          risks: ["情绪消耗继续上升"],
          currentScore: 6,
        },
      })
    ).payload,
    "POST /api/life-decisions/:decisionId/paths work",
  );

  await requestJson(`/api/life-decisions/${decision.id}/paths`, {
    method: "POST",
    body: {
      title: "离职回家准备外国哲学考研",
      description: "观察招生信息、复习节奏和长期匹配。",
      benefits: ["增强思辨能力"],
      risks: ["技术项目积累中断"],
      currentScore: 5,
    },
  });

  const externalSource = expectSuccessEnvelope(
    (
      await requestJson("/api/external-sources", {
        method: "POST",
        body: {
          lifeDecisionId: decision.id,
          title: `广州 AI 应用工程师岗位要求 ${suffix}`,
          sourceSite: "Verify Jobs",
          url: "https://example.com/verify-ai-role",
          summary: "岗位要求强调 AI 应用开发、接口联调、项目落地和沟通表达能力。",
          relationToDecision: "支持继续积累 AI 应用项目，但需要控制情绪消耗。",
        },
      })
    ).payload,
    "POST /api/external-sources",
  );

  const otherDecision = expectSuccessEnvelope(
    (
      await requestJson("/api/life-decisions", {
        method: "POST",
        body: {
          title: `verify-external-impact-other-${suffix}`,
          description: "用于验证 externalSourceIds 必须属于当前 LifeDecision。",
          status: "active",
        },
      })
    ).payload,
    "POST /api/life-decisions other",
  );

  const otherDecisionSource = expectSuccessEnvelope(
    (
      await requestJson("/api/external-sources", {
        method: "POST",
        body: {
          lifeDecisionId: otherDecision.id,
          title: `其他决策来源 ${suffix}`,
          sourceSite: "Verify Other Decision",
          url: "https://example.com/verify-other-decision",
          summary: "该来源只属于另一个人生决策。",
          relationToDecision: "不应被当前决策的 impact-draft 接口接受。",
        },
      })
    ).payload,
    "POST /api/external-sources other decision",
  );

  const draftResponse = await requestJson("/api/external-sources/impact-draft", {
    method: "POST",
    body: {
      lifeDecisionId: decision.id,
      externalSourceIds: [externalSource.id],
      maxItems: 1,
    },
  });
  assertOkStatus(draftResponse, "POST /api/external-sources/impact-draft");
  const draft = expectSuccessEnvelope(
    draftResponse.payload,
    "POST /api/external-sources/impact-draft",
  );

  assert.equal(draft.analysisMode, "deterministic");
  assert.equal(draft.lifeDecisionId, decision.id);
  assert.equal(draft.items.length, 1, "impact draft should create one candidate item");
  assert.equal(draft.items[0].externalSourceId, externalSource.id);
  assert.equal(draft.items[0].pathId, workPath.id);
  assert.equal(draft.items[0].evidenceType, "support");
  assert.equal(draft.items[0].confirmationRequired, true);
  assert.ok(
    draft.items[0].suggestedContent.includes("待用户确认"),
    "suggested content should disclose user confirmation requirement",
  );
  assert.ok(
    draft.warnings.some((warning) => warning.includes("不会自动写入 DecisionEvidence")),
    "warnings should disclose non-persistence",
  );
  assert.deepEqual(draft.sourceSnapshot.selectedSourceIds, [externalSource.id]);
  logPass("POST /api/external-sources/impact-draft returned deterministic candidate draft");

  const detailBeforeConfirm = expectSuccessEnvelope(
    (await requestJson(`/api/life-decisions/${decision.id}`)).payload,
    "GET /api/life-decisions/:id before confirm",
  );
  assert.equal(
    detailBeforeConfirm.evidenceItems.length,
    0,
    "impact draft should not create decision-level evidence automatically",
  );
  assert.equal(
    detailBeforeConfirm.paths.find((path) => path.id === workPath.id).evidenceItems.length,
    0,
    "impact draft should not create path evidence automatically",
  );
  logPass("Impact draft did not persist DecisionEvidence before user confirmation");

  const confirmedEvidenceResponse = await requestJson("/api/decision-evidence", {
    method: "POST",
    body: {
      decisionId: decision.id,
      pathId: draft.items[0].pathId,
      evidenceType: draft.items[0].evidenceType,
      content: draft.items[0].suggestedContent,
      externalSourceId: draft.items[0].externalSourceId,
      weight: draft.items[0].suggestedWeight,
    },
  });
  assertOkStatus(confirmedEvidenceResponse, "POST /api/decision-evidence from draft");
  const confirmedEvidence = expectSuccessEnvelope(
    confirmedEvidenceResponse.payload,
    "POST /api/decision-evidence from draft",
  );
  assert.equal(confirmedEvidence.decisionId, decision.id);
  assert.equal(confirmedEvidence.pathId, workPath.id);
  assert.equal(
    typeof confirmedEvidence.sourceCitationId,
    "string",
    "confirmed evidence should retain sourceCitationId",
  );
  logPass("User-confirmed impact draft can be persisted through DecisionEvidence API");

  const persistedEvidence = await prisma.decisionEvidence.findUnique({
    where: { id: confirmedEvidence.id },
    select: {
      sourceCitationId: true,
      sourceCitation: {
        select: {
          id: true,
          sourceType: true,
          sourceId: true,
          title: true,
          url: true,
          excerpt: true,
          locator: true,
          metadata: true,
        },
      },
    },
  });
  assert.ok(persistedEvidence, "confirmed evidence should exist in the database");
  assert.equal(
    persistedEvidence.sourceCitationId,
    confirmedEvidence.sourceCitationId,
    "database evidence should persist the returned sourceCitationId",
  );
  assert.ok(persistedEvidence.sourceCitation, "confirmed evidence should join a SourceCitation");
  assert.equal(
    persistedEvidence.sourceCitation.sourceType,
    "external_link",
    "citation should be created as an external_link source",
  );
  assert.equal(
    persistedEvidence.sourceCitation.sourceId,
    externalSource.id,
    "citation should point at the confirmed ExternalSource id",
  );
  assert.equal(
    persistedEvidence.sourceCitation.title,
    externalSource.title,
    "citation title should mirror the external source title",
  );
  assert.equal(
    persistedEvidence.sourceCitation.url,
    externalSource.url,
    "citation url should mirror the external source url",
  );
  assert.equal(
    persistedEvidence.sourceCitation.locator,
    `external-source:${externalSource.id}`,
    "citation locator should reference the external source record",
  );
  assert.match(
    persistedEvidence.sourceCitation.excerpt ?? "",
    /AI 应用开发/,
    "citation excerpt should preserve the external source summary context",
  );
  logPass("Confirmed evidence persisted a reusable SourceCitation for the external URL");

  const detailAfterConfirm = expectSuccessEnvelope(
    (await requestJson(`/api/life-decisions/${decision.id}`)).payload,
    "GET /api/life-decisions/:id after confirm",
  );
  const confirmedPathEvidence = detailAfterConfirm.paths
    .find((path) => path.id === workPath.id)
    ?.evidenceItems.find((item) => item.id === confirmedEvidence.id);
  assert.equal(
    confirmedPathEvidence?.sourceCitationId,
    confirmedEvidence.sourceCitationId,
    "life-decision detail should expose the persisted sourceCitationId on path evidence",
  );
  logPass("LifeDecision detail exposes sourceCitationId after confirming impact draft");

  const missingDecisionResponse = await requestJson("/api/external-sources/impact-draft", {
    method: "POST",
    body: {
      lifeDecisionId: missingDecisionId,
      maxItems: 1,
    },
  });
  assert.equal(missingDecisionResponse.status, 404, "missing decision should return 404");
  expectErrorEnvelope(missingDecisionResponse.payload, "POST /impact-draft missing decision");
  logPass("POST /api/external-sources/impact-draft rejected missing decision");

  const invalidMaxItemsResponse = await requestJson("/api/external-sources/impact-draft", {
    method: "POST",
    body: {
      lifeDecisionId: decision.id,
      maxItems: 21,
    },
  });
  assert.equal(invalidMaxItemsResponse.status, 400, "maxItems > 20 should return 400");
  expectErrorEnvelope(invalidMaxItemsResponse.payload, "POST /impact-draft invalid maxItems");
  logPass("POST /api/external-sources/impact-draft rejected invalid maxItems");

  const invalidDecisionIdResponse = await requestJson("/api/external-sources/impact-draft", {
    method: "POST",
    body: {
      lifeDecisionId: "not-a-uuid",
      maxItems: 1,
    },
  });
  assert.equal(invalidDecisionIdResponse.status, 400, "invalid lifeDecisionId should return 400");
  expectErrorEnvelope(
    invalidDecisionIdResponse.payload,
    "POST /impact-draft invalid lifeDecisionId",
  );
  logPass("POST /api/external-sources/impact-draft rejected invalid lifeDecisionId");

  const invalidExternalSourceIdResponse = await requestJson("/api/external-sources/impact-draft", {
    method: "POST",
    body: {
      lifeDecisionId: decision.id,
      externalSourceIds: ["not-a-uuid"],
      maxItems: 1,
    },
  });
  assert.equal(
    invalidExternalSourceIdResponse.status,
    400,
    "invalid externalSourceIds should return 400",
  );
  expectErrorEnvelope(
    invalidExternalSourceIdResponse.payload,
    "POST /impact-draft invalid externalSourceIds",
  );
  logPass("POST /api/external-sources/impact-draft rejected invalid externalSourceIds");

  const duplicateExternalSourceIdResponse = await requestJson("/api/external-sources/impact-draft", {
    method: "POST",
    body: {
      lifeDecisionId: decision.id,
      externalSourceIds: [externalSource.id, externalSource.id],
      maxItems: 1,
    },
  });
  assert.equal(
    duplicateExternalSourceIdResponse.status,
    400,
    "duplicate externalSourceIds should return 400",
  );
  expectErrorEnvelope(
    duplicateExternalSourceIdResponse.payload,
    "POST /impact-draft duplicate externalSourceIds",
  );
  logPass("POST /api/external-sources/impact-draft rejected duplicate externalSourceIds");

  const foreignSourceResponse = await requestJson("/api/external-sources/impact-draft", {
    method: "POST",
    body: {
      lifeDecisionId: decision.id,
      externalSourceIds: [otherDecisionSource.id],
      maxItems: 1,
    },
  });
  assert.equal(
    foreignSourceResponse.status,
    404,
    "externalSourceIds outside the requested decision should return 404",
  );
  expectErrorEnvelope(
    foreignSourceResponse.payload,
    "POST /impact-draft externalSourceIds outside decision",
  );
  logPass(
    "POST /api/external-sources/impact-draft rejected externalSourceIds outside the requested LifeDecision",
  );

  const noPathDecision = expectSuccessEnvelope(
    (
      await requestJson("/api/life-decisions", {
        method: "POST",
        body: {
          title: `verify-external-impact-no-path-${suffix}`,
          description: "用于验证没有路径时的提示。",
          status: "active",
        },
      })
    ).payload,
    "POST /api/life-decisions no path",
  );

  await requestJson("/api/external-sources", {
    method: "POST",
    body: {
      lifeDecisionId: noPathDecision.id,
      title: `无路径来源 ${suffix}`,
      sourceSite: "Verify No Path",
      url: "https://example.com/verify-no-path",
      summary: "有外部来源，但没有候选路径。",
      relationToDecision: "应返回空 items 并提示无法生成路径级草稿。",
    },
  });

  const noPathDraft = expectSuccessEnvelope(
    (
      await requestJson("/api/external-sources/impact-draft", {
        method: "POST",
        body: {
          lifeDecisionId: noPathDecision.id,
          maxItems: 1,
        },
      })
    ).payload,
    "POST /impact-draft no paths",
  );
  assert.equal(noPathDraft.items.length, 0, "decision without paths should yield no draft items");
  assert.ok(
    noPathDraft.warnings.some((warning) => warning.includes("没有候选路径")),
    "decision without paths should return a no-path warning",
  );
  logPass("POST /api/external-sources/impact-draft warns when the decision has no paths");

  const noSourceDecision = expectSuccessEnvelope(
    (
      await requestJson("/api/life-decisions", {
        method: "POST",
        body: {
          title: `verify-external-impact-no-source-${suffix}`,
          description: "用于验证没有外部来源时的提示。",
          status: "active",
        },
      })
    ).payload,
    "POST /api/life-decisions no source",
  );

  await requestJson(`/api/life-decisions/${noSourceDecision.id}/paths`, {
    method: "POST",
    body: {
      title: "仅有路径，没有外部来源",
      description: "确认空来源时不会生成草稿。",
      benefits: ["可以验证空来源提示"],
      risks: ["没有可用外部信息"],
      currentScore: 4,
    },
  });

  const noSourceDraft = expectSuccessEnvelope(
    (
      await requestJson("/api/external-sources/impact-draft", {
        method: "POST",
        body: {
          lifeDecisionId: noSourceDecision.id,
          maxItems: 1,
        },
      })
    ).payload,
    "POST /impact-draft no sources",
  );
  assert.equal(noSourceDraft.items.length, 0, "decision without sources should yield no draft items");
  assert.ok(
    noSourceDraft.warnings.some((warning) => warning.includes("没有关联外部来源")),
    "decision without sources should return a no-source warning",
  );
  logPass("POST /api/external-sources/impact-draft warns when the decision has no sources");

  logPass("ExternalSource impact draft API verification completed");
} catch (error) {
  logFail(formatError(error));
  process.exit(1);
} finally {
  await prisma.$disconnect();
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
  }
}

async function ensureApiServer() {
  if (await isApiHealthy()) {
    logStep("Detected an existing API server");
    return null;
  }

  logStep("Starting the built API server for impact draft verification");
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
  };
}

function expectSuccessEnvelope(payload, label) {
  assert.ok(payload, `${label} should return a JSON payload`);
  assert.equal(payload.error, null, `${label} should return error=null`);
  assert.ok(payload.data, `${label} should return data`);
  assert.equal(typeof payload.requestId, "string", `${label} should include requestId`);
  return payload.data;
}

function expectErrorEnvelope(payload, label) {
  assert.ok(payload, `${label} should return a JSON payload`);
  assert.equal(payload.data, null, `${label} should return data=null`);
  assert.ok(payload.error, `${label} should include error`);
  assert.equal(typeof payload.error.message, "string", `${label} should include error.message`);
  assert.equal(typeof payload.requestId, "string", `${label} should include requestId`);
}

function assertOkStatus(response, label) {
  assert.ok(
    response.status >= 200 && response.status < 300,
    `${label} should return 2xx, got ${response.status} ${response.statusText}`,
  );
}

function safeJsonParse(rawText) {
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function formatError(error) {
  return error instanceof Error ? error.stack ?? error.message : String(error);
}

function logStep(message) {
  console.log(`[verify:external-source-impact-draft] ${message}`);
}

function logPass(message) {
  console.log(`[verify:external-source-impact-draft] PASS ${message}`);
}

function logFail(message) {
  console.error(`[verify:external-source-impact-draft] FAIL ${message}`);
}
