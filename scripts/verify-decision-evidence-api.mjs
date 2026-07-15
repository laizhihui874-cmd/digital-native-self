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
  process.env.DECISION_EVIDENCE_API_BASE_URL ?? process.env.API_BASE_URL ?? DEFAULT_BASE_URL,
);
const healthPath = process.env.DECISION_EVIDENCE_HEALTH_PATH ?? DEFAULT_HEALTH_PATH;
const suffix = new Date().toISOString().replace(/[:.]/g, "-");

const createDecisionPayload = {
  title: `verify-decision-evidence-${suffix}`,
  description: `用于验证 DecisionEvidence 回填 ${suffix}`,
};

const createSiblingDecisionPayload = {
  title: `verify-decision-evidence-sibling-${suffix}`,
};

const createPathPayload = {
  title: `  path-for-evidence-${suffix}  `,
  description: `路径 ${suffix}`,
  benefits: [`benefit-${suffix}`],
  risks: [`risk-${suffix}`],
  currentScore: 6.5,
};

const createSiblingPathPayload = {
  title: `  sibling-path-for-evidence-${suffix}  `,
  description: `兄弟路径 ${suffix}`,
};

const createEvidencePayload = {
  evidenceType: "support",
  content: `  这是支持该路径的证据 ${suffix}  `,
  weight: 0.8,
};

const createSiblingEvidencePayload = {
  evidenceType: "neutral",
  content: `  这是另一个决策的证据 ${suffix}  `,
  weight: 0.3,
};

const updateEvidencePayload = {
  evidenceType: "against",
  content: `  更新后的反对证据 ${suffix}  `,
  weight: 0.2,
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
  logPass(`POST /api/life-decisions created id=${createdDecision.id}`);

  const createdSiblingDecisionResponse = await requestJson("/api/life-decisions", {
    method: "POST",
    body: createSiblingDecisionPayload,
  });
  assertOkStatus(createdSiblingDecisionResponse, "POST /api/life-decisions sibling");
  const createdSiblingDecision = expectSuccessEnvelope(
    createdSiblingDecisionResponse.payload,
    "POST /api/life-decisions sibling",
  );
  logPass(`POST /api/life-decisions created sibling id=${createdSiblingDecision.id}`);

  const createdPathResponse = await requestJson(`/api/life-decisions/${createdDecision.id}/paths`, {
    method: "POST",
    body: createPathPayload,
  });
  assertOkStatus(createdPathResponse, `POST /api/life-decisions/${createdDecision.id}/paths`);
  const createdPath = expectSuccessEnvelope(
    createdPathResponse.payload,
    `POST /api/life-decisions/${createdDecision.id}/paths`,
  );
  assert.equal(createdPath.title, createPathPayload.title.trim(), "created path title should be trimmed");
  logPass(`POST /api/life-decisions/:decisionId/paths created id=${createdPath.id}`);

  const createdSiblingPathResponse = await requestJson(
    `/api/life-decisions/${createdSiblingDecision.id}/paths`,
    {
      method: "POST",
      body: createSiblingPathPayload,
    },
  );
  assertOkStatus(
    createdSiblingPathResponse,
    `POST /api/life-decisions/${createdSiblingDecision.id}/paths`,
  );
  const createdSiblingPath = expectSuccessEnvelope(
    createdSiblingPathResponse.payload,
    `POST /api/life-decisions/${createdSiblingDecision.id}/paths`,
  );
  logPass(`POST /api/life-decisions/:decisionId/paths created sibling path id=${createdSiblingPath.id}`);

  const createdEvidenceResponse = await requestJson("/api/decision-evidence", {
    method: "POST",
    body: {
      decisionId: createdDecision.id,
      pathId: createdPath.id,
      ...createEvidencePayload,
    },
  });
  assertOkStatus(createdEvidenceResponse, "POST /api/decision-evidence");
  const createdEvidence = expectSuccessEnvelope(
    createdEvidenceResponse.payload,
    "POST /api/decision-evidence",
  );

  assert.equal(createdEvidence.decisionId, createdDecision.id, "created evidence decisionId should match");
  assert.equal(createdEvidence.pathId, createdPath.id, "created evidence pathId should match");
  assert.equal(createdEvidence.evidenceType, "support", "created evidence type should match");
  assert.equal(
    createdEvidence.content,
    createEvidencePayload.content.trim(),
    "created evidence content should be trimmed",
  );
  assert.equal(createdEvidence.weight, createEvidencePayload.weight, "created evidence weight should match");
  logPass(`POST /api/decision-evidence created id=${createdEvidence.id}`);

  const createdSiblingEvidenceResponse = await requestJson("/api/decision-evidence", {
    method: "POST",
    body: {
      decisionId: createdSiblingDecision.id,
      pathId: createdSiblingPath.id,
      ...createSiblingEvidencePayload,
    },
  });
  assertOkStatus(createdSiblingEvidenceResponse, "POST /api/decision-evidence sibling");
  const createdSiblingEvidence = expectSuccessEnvelope(
    createdSiblingEvidenceResponse.payload,
    "POST /api/decision-evidence sibling",
  );
  logPass(`POST /api/decision-evidence created sibling id=${createdSiblingEvidence.id}`);

  const listAllResponse = await requestJson("/api/decision-evidence");
  assertOkStatus(listAllResponse, "GET /api/decision-evidence");
  const allEvidenceItems = expectSuccessEnvelope(
    listAllResponse.payload,
    "GET /api/decision-evidence",
  );
  assert.ok(Array.isArray(allEvidenceItems), "GET /api/decision-evidence should return an array");
  assert.ok(
    allEvidenceItems.length >= 2,
    "GET /api/decision-evidence should return at least the newly created owned items",
  );
  const allEvidenceIds = new Set(allEvidenceItems.map((item) => item.id));
  assert.ok(
    allEvidenceIds.has(createdEvidence.id),
    "GET /api/decision-evidence should include the primary created evidence id",
  );
  assert.ok(
    allEvidenceIds.has(createdSiblingEvidence.id),
    "GET /api/decision-evidence should include the sibling created evidence id",
  );
  logPass("GET /api/decision-evidence listed owned evidence items");

  const paginatedListResponse = await requestJson("/api/decision-evidence?limit=1&offset=0");
  assertOkStatus(paginatedListResponse, "GET /api/decision-evidence paginated");
  const paginatedList = expectSuccessEnvelope(
    paginatedListResponse.payload,
    "GET /api/decision-evidence paginated",
  );
  assert.ok(Array.isArray(paginatedList.items), "paginated decision evidence should include items array");
  assert.equal(paginatedList.items.length, 1, "paginated decision evidence should honor limit=1");
  assert.equal(paginatedList.pagination.limit, 1, "paginated decision evidence should echo limit");
  assert.equal(paginatedList.pagination.offset, 0, "paginated decision evidence should echo offset");
  assert.ok(
    paginatedList.pagination.total >= 2,
    "paginated decision evidence should include total owned evidence count",
  );
  logPass("GET /api/decision-evidence supports limit/offset pagination");

  const invalidPaginationResponse = await requestJson("/api/decision-evidence?limit=101&offset=0");
  assert.equal(
    invalidPaginationResponse.status,
    400,
    `GET /api/decision-evidence with invalid limit should return 400, got ${invalidPaginationResponse.status}`,
  );
  expectErrorEnvelope(invalidPaginationResponse.payload, "GET /api/decision-evidence invalid pagination");
  logPass("GET /api/decision-evidence rejected invalid pagination");

  const listByDecisionResponse = await requestJson(`/api/decision-evidence?decisionId=${createdDecision.id}`);
  assertOkStatus(listByDecisionResponse, "GET /api/decision-evidence?decisionId");
  const decisionEvidenceItems = expectSuccessEnvelope(
    listByDecisionResponse.payload,
    "GET /api/decision-evidence?decisionId",
  );
  assert.equal(decisionEvidenceItems.length, 1, "decisionId filter should return one evidence item");
  assert.equal(
    decisionEvidenceItems[0].id,
    createdEvidence.id,
    "decisionId filter should return the target evidence item",
  );
  logPass("GET /api/decision-evidence filtered by decisionId");

  const listByPathResponse = await requestJson(`/api/decision-evidence?pathId=${createdPath.id}`);
  assertOkStatus(listByPathResponse, "GET /api/decision-evidence?pathId");
  const pathEvidenceItems = expectSuccessEnvelope(
    listByPathResponse.payload,
    "GET /api/decision-evidence?pathId",
  );
  assert.equal(pathEvidenceItems.length, 1, "pathId filter should return one evidence item");
  assert.equal(pathEvidenceItems[0].id, createdEvidence.id, "pathId filter should return the target evidence");
  logPass("GET /api/decision-evidence filtered by pathId");

  const findByIdResponse = await requestJson(`/api/decision-evidence/${createdEvidence.id}`);
  assertOkStatus(findByIdResponse, `GET /api/decision-evidence/${createdEvidence.id}`);
  const fetchedEvidence = expectSuccessEnvelope(
    findByIdResponse.payload,
    `GET /api/decision-evidence/${createdEvidence.id}`,
  );
  assert.equal(fetchedEvidence.id, createdEvidence.id, "GET /api/decision-evidence/:id should return the target id");
  assert.equal(
    fetchedEvidence.content,
    createEvidencePayload.content.trim(),
    "GET /api/decision-evidence/:id should return trimmed content",
  );
  logPass("GET /api/decision-evidence/:id returned the created evidence");

  const updatedEvidenceResponse = await requestJson(`/api/decision-evidence/${createdEvidence.id}`, {
    method: "PATCH",
    body: updateEvidencePayload,
  });
  assertOkStatus(updatedEvidenceResponse, `PATCH /api/decision-evidence/${createdEvidence.id}`);
  const updatedEvidence = expectSuccessEnvelope(
    updatedEvidenceResponse.payload,
    `PATCH /api/decision-evidence/${createdEvidence.id}`,
  );
  assert.equal(updatedEvidence.id, createdEvidence.id, "PATCH should preserve id");
  assert.equal(updatedEvidence.decisionId, createdDecision.id, "PATCH should preserve decisionId");
  assert.equal(updatedEvidence.pathId, createdPath.id, "PATCH should preserve pathId");
  assert.equal(updatedEvidence.evidenceType, updateEvidencePayload.evidenceType, "PATCH should update evidenceType");
  assert.equal(updatedEvidence.content, updateEvidencePayload.content.trim(), "PATCH should trim content");
  assert.equal(updatedEvidence.weight, updateEvidencePayload.weight, "PATCH should update weight");
  logPass("PATCH /api/decision-evidence/:id updated supported fields");

  const detailResponse = await requestJson(`/api/life-decisions/${createdDecision.id}`);
  assertOkStatus(detailResponse, `GET /api/life-decisions/${createdDecision.id}`);
  const detail = expectSuccessEnvelope(
    detailResponse.payload,
    `GET /api/life-decisions/${createdDecision.id}`,
  );

  assert.ok(Array.isArray(detail.evidenceItems), "decision detail should include decision-level evidenceItems");
  assert.equal(detail.evidenceItems.length, 1, "decision detail should include one evidence item");
  assert.equal(detail.evidenceItems[0].id, createdEvidence.id, "decision detail evidence item id should match");
  assert.equal(
    detail.evidenceItems[0].evidenceType,
    updateEvidencePayload.evidenceType,
    "decision detail should reflect updated evidenceType",
  );
  assert.equal(
    detail.evidenceItems[0].content,
    updateEvidencePayload.content.trim(),
    "decision detail should reflect updated content",
  );

  assert.ok(Array.isArray(detail.paths), "decision detail should include paths array");
  assert.equal(detail.paths.length, 1, "decision detail should include one path");
  assert.ok(Array.isArray(detail.paths[0].evidenceItems), "path detail should include evidenceItems");
  assert.equal(detail.paths[0].evidenceItems.length, 1, "path detail should include one evidence item");
  assert.equal(
    detail.paths[0].evidenceItems[0].id,
    createdEvidence.id,
    "path detail evidence item id should match",
  );
  assert.equal(
    detail.paths[0].evidenceItems[0].weight,
    updateEvidencePayload.weight,
    "path detail should reflect updated weight",
  );
  logPass("GET /api/life-decisions/:id reflected decision-level and path-level evidenceItems");

  const wrongDecisionResponse = await requestJson("/api/decision-evidence", {
    method: "POST",
    body: {
      decisionId: createdSiblingDecision.id,
      pathId: createdPath.id,
      evidenceType: "support",
      content: "should-not-work",
    },
  });
  assert.equal(
    wrongDecisionResponse.status,
    404,
    `POST /api/decision-evidence with wrong decision should return 404, got ${wrongDecisionResponse.status}`,
  );
  expectErrorEnvelope(wrongDecisionResponse.payload, "POST /api/decision-evidence wrong decision");
  logPass("POST /api/decision-evidence with a mismatched decision/path pair returned 404");

  const missingDecisionResponse = await requestJson("/api/decision-evidence", {
    method: "POST",
    body: {
      decisionId: missingDecisionId,
      pathId: createdPath.id,
      evidenceType: "support",
      content: "missing-decision",
    },
  });
  assert.equal(
    missingDecisionResponse.status,
    404,
    `POST /api/decision-evidence with missing decision should return 404, got ${missingDecisionResponse.status}`,
  );
  expectErrorEnvelope(missingDecisionResponse.payload, "POST /api/decision-evidence missing decision");
  logPass("POST /api/decision-evidence with a missing decision returned 404");

  const missingPathResponse = await requestJson("/api/decision-evidence", {
    method: "POST",
    body: {
      decisionId: createdDecision.id,
      pathId: missingPathId,
      evidenceType: "support",
      content: "missing-path",
    },
  });
  assert.equal(
    missingPathResponse.status,
    404,
    `POST /api/decision-evidence with missing path should return 404, got ${missingPathResponse.status}`,
  );
  expectErrorEnvelope(missingPathResponse.payload, "POST /api/decision-evidence missing path");
  logPass("POST /api/decision-evidence with a missing path returned 404");

  const invalidEvidenceTypeResponse = await requestJson("/api/decision-evidence", {
    method: "POST",
    body: {
      decisionId: createdDecision.id,
      pathId: createdPath.id,
      evidenceType: "invalid",
      content: "invalid-type",
    },
  });
  assert.equal(
    invalidEvidenceTypeResponse.status,
    400,
    `POST /api/decision-evidence with invalid evidenceType should return 400, got ${invalidEvidenceTypeResponse.status}`,
  );
  expectErrorEnvelope(invalidEvidenceTypeResponse.payload, "POST /api/decision-evidence invalid evidenceType");
  logPass("POST /api/decision-evidence with an invalid evidenceType returned 400");

  const invalidWeightResponse = await requestJson("/api/decision-evidence", {
    method: "POST",
    body: {
      decisionId: createdDecision.id,
      pathId: createdPath.id,
      evidenceType: "support",
      content: "invalid-weight",
      weight: 1.5,
    },
  });
  assert.equal(
    invalidWeightResponse.status,
    400,
    `POST /api/decision-evidence with invalid weight should return 400, got ${invalidWeightResponse.status}`,
  );
  expectErrorEnvelope(invalidWeightResponse.payload, "POST /api/decision-evidence invalid weight");
  logPass("POST /api/decision-evidence with an invalid weight returned 400");

  const invalidPatchResponse = await requestJson(`/api/decision-evidence/${createdEvidence.id}`, {
    method: "PATCH",
    body: {
      evidenceType: "invalid",
    },
  });
  assert.equal(
    invalidPatchResponse.status,
    400,
    `PATCH /api/decision-evidence/:id with invalid evidenceType should return 400, got ${invalidPatchResponse.status}`,
  );
  expectErrorEnvelope(invalidPatchResponse.payload, "PATCH /api/decision-evidence/:id invalid evidenceType");
  logPass("PATCH /api/decision-evidence/:id with an invalid evidenceType returned 400");

  const invalidPatchWeightResponse = await requestJson(`/api/decision-evidence/${createdEvidence.id}`, {
    method: "PATCH",
    body: {
      weight: -0.1,
    },
  });
  assert.equal(
    invalidPatchWeightResponse.status,
    400,
    `PATCH /api/decision-evidence/:id with invalid weight should return 400, got ${invalidPatchWeightResponse.status}`,
  );
  expectErrorEnvelope(invalidPatchWeightResponse.payload, "PATCH /api/decision-evidence/:id invalid weight");
  logPass("PATCH /api/decision-evidence/:id with an invalid weight returned 400");

  const deleteResponse = await requestJson(`/api/decision-evidence/${createdEvidence.id}`, {
    method: "DELETE",
  });
  assert.equal(
    deleteResponse.status,
    204,
    `DELETE /api/decision-evidence/:id should return 204, got ${deleteResponse.status}`,
  );
  logPass("DELETE /api/decision-evidence/:id returned 204");

  const deletedFindResponse = await requestJson(`/api/decision-evidence/${createdEvidence.id}`);
  assert.equal(
    deletedFindResponse.status,
    404,
    `GET /api/decision-evidence/:id after delete should return 404, got ${deletedFindResponse.status}`,
  );
  expectErrorEnvelope(
    deletedFindResponse.payload,
    "GET /api/decision-evidence/:id after delete",
  );
  logPass("GET /api/decision-evidence/:id returned 404 after delete");

  const deletedDecisionListResponse = await requestJson(`/api/decision-evidence?decisionId=${createdDecision.id}`);
  assertOkStatus(deletedDecisionListResponse, "GET /api/decision-evidence?decisionId after delete");
  const deletedDecisionEvidenceItems = expectSuccessEnvelope(
    deletedDecisionListResponse.payload,
    "GET /api/decision-evidence?decisionId after delete",
  );
  assert.equal(
    deletedDecisionEvidenceItems.length,
    0,
    "decisionId filter should return no items after delete",
  );

  const detailAfterDeleteResponse = await requestJson(`/api/life-decisions/${createdDecision.id}`);
  assertOkStatus(detailAfterDeleteResponse, `GET /api/life-decisions/${createdDecision.id} after delete`);
  const detailAfterDelete = expectSuccessEnvelope(
    detailAfterDeleteResponse.payload,
    `GET /api/life-decisions/${createdDecision.id} after delete`,
  );
  assert.equal(detailAfterDelete.evidenceItems.length, 0, "decision detail should remove deleted evidence");
  assert.equal(
    detailAfterDelete.paths[0].evidenceItems.length,
    0,
    "path detail should remove deleted evidence",
  );
  logPass("GET /api/life-decisions/:id removed deleted evidence from both detail arrays");

  logPass("DecisionEvidence API verification completed");
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
  console.log(`[verify:decision-evidence] ${message}`);
}

function logPass(message) {
  console.log(`[verify:decision-evidence] PASS ${message}`);
}

function logFail(message) {
  console.error(`[verify:decision-evidence] FAIL ${message}`);
}
