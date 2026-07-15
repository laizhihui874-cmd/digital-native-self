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
const FOREIGN_USER_ID = "00000000-0000-0000-0000-000000000099";

const baseUrl = normalizeBaseUrl(
  process.env.EXTERNAL_SOURCES_API_BASE_URL ?? process.env.API_BASE_URL ?? DEFAULT_BASE_URL,
);
const healthPath = process.env.EXTERNAL_SOURCES_HEALTH_PATH ?? DEFAULT_HEALTH_PATH;
const suffix = new Date().toISOString().replace(/[:.]/g, "-");
const prisma = new PrismaClient();

const missingDecisionId = "11111111-1111-4111-8111-111111111111";

let serverProcess = null;

try {
  logStep(`Using base URL: ${baseUrl}`);
  serverProcess = await ensureApiServer();

  const primaryDecision = await createLifeDecision(`verify-external-source-primary-${suffix}`);
  const secondaryDecision = await createLifeDecision(`verify-external-source-secondary-${suffix}`);
  const foreignDecisionId = await createForeignLifeDecision();

  const createdAttachedResponse = await requestJson("/api/external-sources", {
    method: "POST",
    body: {
      title: `  外部来源-${suffix}  `,
      sourceSite: "  Example News  ",
      url: `https://example.com/articles/${suffix}`,
      publishedAt: "2026-06-18T08:00:00.000Z",
      summary: `  摘要 ${suffix}  `,
      relationToDecision: `  影响判断 ${suffix}  `,
      lifeDecisionId: primaryDecision.id,
    },
  });
  assertOkStatus(createdAttachedResponse, "POST /api/external-sources");
  const createdAttached = expectSuccessEnvelope(
    createdAttachedResponse.payload,
    "POST /api/external-sources",
  );

  assert.equal(createdAttached.lifeDecisionId, primaryDecision.id, "created source should bind to decision");
  assert.equal(createdAttached.title, `外部来源-${suffix}`, "created source title should be trimmed");
  assert.equal(createdAttached.sourceSite, "Example News", "created source site should be trimmed");
  assert.equal(createdAttached.summary, `摘要 ${suffix}`, "created source summary should be trimmed");
  assert.equal(
    createdAttached.relationToDecision,
    `影响判断 ${suffix}`,
    "created source relation should be trimmed",
  );
  assert.equal(
    createdAttached.publishedAt,
    "2026-06-18T08:00:00.000Z",
    "created source publishedAt should match",
  );
  assert.equal(createdAttached.url, `https://example.com/articles/${suffix}`, "created source url should match");
  assert.equal(typeof createdAttached.fetchedAt, "string", "created source should expose fetchedAt");
  assert.notEqual(createdAttached.fetchedAt.length, 0, "created source fetchedAt should not be empty");
  logPass(`POST /api/external-sources created attached source id=${createdAttached.id}`);

  const createdUnattachedResponse = await requestJson("/api/external-sources", {
    method: "POST",
    body: {
      title: `standalone-source-${suffix}`,
      sourceSite: "Standalone Site",
      url: `https://example.org/standalone/${suffix}`,
    },
  });
  assertOkStatus(createdUnattachedResponse, "POST /api/external-sources standalone");
  const createdUnattached = expectSuccessEnvelope(
    createdUnattachedResponse.payload,
    "POST /api/external-sources standalone",
  );
  assert.equal(createdUnattached.lifeDecisionId, null, "standalone source should not bind to a decision");
  logPass(`POST /api/external-sources created standalone source id=${createdUnattached.id}`);

  const listResponse = await requestJson("/api/external-sources?limit=10&offset=0");
  assertOkStatus(listResponse, "GET /api/external-sources");
  const listedSources = expectSuccessEnvelope(listResponse.payload, "GET /api/external-sources");

  assert.ok(Array.isArray(listedSources.items), "external-source list should include items");
  assert.equal(listedSources.pagination.limit, 10, "list pagination limit should match query");
  assert.equal(listedSources.pagination.offset, 0, "list pagination offset should match query");
  assert.ok(listedSources.pagination.total >= 2, "list total should include created sources");
  assert.ok(
    listedSources.items.some((item) => item.id === createdAttached.id),
    "list should include attached source",
  );
  assert.ok(
    listedSources.items.some((item) => item.id === createdUnattached.id),
    "list should include standalone source",
  );
  logPass("GET /api/external-sources returned paginated owned sources");

  const filteredListResponse = await requestJson(
    `/api/external-sources?lifeDecisionId=${primaryDecision.id}&limit=10&offset=0`,
  );
  assertOkStatus(filteredListResponse, "GET /api/external-sources?lifeDecisionId");
  const filteredSources = expectSuccessEnvelope(
    filteredListResponse.payload,
    "GET /api/external-sources?lifeDecisionId",
  );

  assert.equal(filteredSources.items.length, 1, "filtered list should only include one source");
  assert.equal(filteredSources.items[0].id, createdAttached.id, "filtered list source id should match");
  assert.equal(filteredSources.pagination.total, 1, "filtered list total should match");
  logPass("GET /api/external-sources filtered by lifeDecisionId");

  const detailResponse = await requestJson(`/api/external-sources/${createdAttached.id}`);
  assertOkStatus(detailResponse, `GET /api/external-sources/${createdAttached.id}`);
  const detail = expectSuccessEnvelope(
    detailResponse.payload,
    `GET /api/external-sources/${createdAttached.id}`,
  );

  assert.equal(detail.id, createdAttached.id, "detail id should match");
  assert.equal(detail.lifeDecisionId, primaryDecision.id, "detail decision binding should match");
  logPass("GET /api/external-sources/:id returned the created source");

  const lifeDecisionDetailBeforeUpdate = await requestJson(`/api/life-decisions/${primaryDecision.id}`);
  assertOkStatus(
    lifeDecisionDetailBeforeUpdate,
    `GET /api/life-decisions/${primaryDecision.id} before external-source update`,
  );
  const primaryDetailBeforeUpdate = expectSuccessEnvelope(
    lifeDecisionDetailBeforeUpdate.payload,
    `GET /api/life-decisions/${primaryDecision.id} before external-source update`,
  );

  assert.ok(
    primaryDetailBeforeUpdate.externalSources.some((item) => item.id === createdAttached.id),
    "life-decision detail should backfill linked external sources",
  );
  logPass("GET /api/life-decisions/:id backfilled externalSources");

  const updatedResponse = await requestJson(`/api/external-sources/${createdAttached.id}`, {
    method: "PATCH",
    body: {
      title: `updated-source-${suffix}`,
      sourceSite: "Updated Site",
      url: `https://example.net/updated/${suffix}`,
      publishedAt: null,
      summary: null,
      relationToDecision: `updated-relation-${suffix}`,
      lifeDecisionId: secondaryDecision.id,
    },
  });
  assertOkStatus(updatedResponse, `PATCH /api/external-sources/${createdAttached.id}`);
  const updatedSource = expectSuccessEnvelope(
    updatedResponse.payload,
    `PATCH /api/external-sources/${createdAttached.id}`,
  );

  assert.equal(updatedSource.title, `updated-source-${suffix}`, "updated title should match");
  assert.equal(updatedSource.sourceSite, "Updated Site", "updated sourceSite should match");
  assert.equal(updatedSource.url, `https://example.net/updated/${suffix}`, "updated url should match");
  assert.equal(updatedSource.publishedAt, null, "updated publishedAt should become null");
  assert.equal(updatedSource.summary, null, "updated summary should become null");
  assert.equal(
    updatedSource.relationToDecision,
    `updated-relation-${suffix}`,
    "updated relation should match",
  );
  assert.equal(
    updatedSource.lifeDecisionId,
    secondaryDecision.id,
    "updated source should rebind to the secondary decision",
  );
  logPass("PATCH /api/external-sources/:id updated supported fields and rebound the decision");

  const secondaryDetailResponse = await requestJson(`/api/life-decisions/${secondaryDecision.id}`);
  assertOkStatus(secondaryDetailResponse, `GET /api/life-decisions/${secondaryDecision.id}`);
  const secondaryDetail = expectSuccessEnvelope(
    secondaryDetailResponse.payload,
    `GET /api/life-decisions/${secondaryDecision.id}`,
  );

  assert.ok(
    secondaryDetail.externalSources.some((item) => item.id === createdAttached.id),
    "updated life-decision detail should include rebound external source",
  );
  logPass("GET /api/life-decisions/:id reflected rebound externalSources");

  const primaryDetailAfterUpdateResponse = await requestJson(`/api/life-decisions/${primaryDecision.id}`);
  assertOkStatus(
    primaryDetailAfterUpdateResponse,
    `GET /api/life-decisions/${primaryDecision.id} after external-source update`,
  );
  const primaryDetailAfterUpdate = expectSuccessEnvelope(
    primaryDetailAfterUpdateResponse.payload,
    `GET /api/life-decisions/${primaryDecision.id} after external-source update`,
  );

  assert.ok(
    primaryDetailAfterUpdate.externalSources.every((item) => item.id !== createdAttached.id),
    "previous life-decision detail should no longer include the rebound source",
  );
  logPass("Rebinding removed the source from the previous life-decision detail");

  const clearedAssociationResponse = await requestJson(`/api/external-sources/${createdAttached.id}`, {
    method: "PATCH",
    body: {
      lifeDecisionId: null,
    },
  });
  assertOkStatus(clearedAssociationResponse, `PATCH /api/external-sources/${createdAttached.id} clear relation`);
  const clearedAssociation = expectSuccessEnvelope(
    clearedAssociationResponse.payload,
    `PATCH /api/external-sources/${createdAttached.id} clear relation`,
  );

  assert.equal(clearedAssociation.lifeDecisionId, null, "cleared association should set lifeDecisionId to null");
  logPass("PATCH /api/external-sources/:id accepted lifeDecisionId=null and cleared the relation");

  const secondaryDetailAfterClearResponse = await requestJson(`/api/life-decisions/${secondaryDecision.id}`);
  assertOkStatus(
    secondaryDetailAfterClearResponse,
    `GET /api/life-decisions/${secondaryDecision.id} after clearing external-source relation`,
  );
  const secondaryDetailAfterClear = expectSuccessEnvelope(
    secondaryDetailAfterClearResponse.payload,
    `GET /api/life-decisions/${secondaryDecision.id} after clearing external-source relation`,
  );

  assert.ok(
    secondaryDetailAfterClear.externalSources.every((item) => item.id !== createdAttached.id),
    "life-decision detail should no longer include the source after clearing relation",
  );
  logPass("Clearing lifeDecisionId removed the source from life-decision detail");

  const invalidUrlResponse = await requestJson("/api/external-sources", {
    method: "POST",
    body: {
      title: `invalid-url-${suffix}`,
      sourceSite: "Broken Source",
      url: "not-a-url",
    },
  });
  assert.equal(
    invalidUrlResponse.status,
    400,
    `POST /api/external-sources with invalid url should return 400, got ${invalidUrlResponse.status}`,
  );
  expectErrorEnvelope(invalidUrlResponse.payload, "POST /api/external-sources invalid url");
  logPass("POST /api/external-sources with invalid url returned 400");

  const missingDecisionResponse = await requestJson("/api/external-sources", {
    method: "POST",
    body: {
      title: `missing-decision-${suffix}`,
      sourceSite: "Missing Decision Site",
      url: `https://example.com/missing/${suffix}`,
      lifeDecisionId: missingDecisionId,
    },
  });
  assert.equal(
    missingDecisionResponse.status,
    404,
    `POST /api/external-sources with missing lifeDecisionId should return 404, got ${missingDecisionResponse.status}`,
  );
  expectErrorEnvelope(missingDecisionResponse.payload, "POST /api/external-sources missing decision");
  logPass("POST /api/external-sources with missing lifeDecisionId returned 404");

  const foreignDecisionResponse = await requestJson(`/api/external-sources/${createdUnattached.id}`, {
    method: "PATCH",
    body: {
      lifeDecisionId: foreignDecisionId,
    },
  });
  assert.equal(
    foreignDecisionResponse.status,
    404,
    `PATCH /api/external-sources/:id with foreign lifeDecisionId should return 404, got ${foreignDecisionResponse.status}`,
  );
  expectErrorEnvelope(
    foreignDecisionResponse.payload,
    "PATCH /api/external-sources/:id foreign decision binding",
  );
  logPass("PATCH /api/external-sources/:id with a foreign lifeDecisionId returned 404");

  const deleteResponse = await requestJson(`/api/external-sources/${createdAttached.id}`, {
    method: "DELETE",
  });
  assert.equal(
    deleteResponse.status,
    204,
    `DELETE /api/external-sources/:id should return 204, got ${deleteResponse.status}`,
  );
  logPass("DELETE /api/external-sources/:id returned 204");

  const deletedDetailResponse = await requestJson(`/api/external-sources/${createdAttached.id}`);
  assert.equal(
    deletedDetailResponse.status,
    404,
    `GET /api/external-sources/:id after delete should return 404, got ${deletedDetailResponse.status}`,
  );
  expectErrorEnvelope(
    deletedDetailResponse.payload,
    "GET /api/external-sources/:id after delete",
  );
  logPass("GET /api/external-sources/:id after delete returned 404");

  logPass("ExternalSource API verification completed");
} catch (error) {
  logFail(formatError(error));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  await stopApiServer(serverProcess);
}

async function createLifeDecision(title) {
  const response = await requestJson("/api/life-decisions", {
    method: "POST",
    body: { title },
  });
  assertOkStatus(response, `POST /api/life-decisions for ${title}`);
  return expectSuccessEnvelope(response.payload, `POST /api/life-decisions for ${title}`);
}

async function createForeignLifeDecision() {
  await prisma.user.upsert({
    where: { id: FOREIGN_USER_ID },
    update: {},
    create: {
      id: FOREIGN_USER_ID,
      displayName: "Foreign Verify User",
      timezone: "Asia/Shanghai",
    },
  });

  const decision = await prisma.lifeDecision.create({
    data: {
      userId: FOREIGN_USER_ID,
      title: `foreign-external-source-decision-${suffix}`,
      status: "active",
    },
    select: {
      id: true,
    },
  });

  return decision.id;
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
  console.log(`[verify:external-sources] ${message}`);
}

function logPass(message) {
  console.log(`[verify:external-sources] PASS ${message}`);
}

function logFail(message) {
  console.error(`[verify:external-sources] FAIL ${message}`);
}
