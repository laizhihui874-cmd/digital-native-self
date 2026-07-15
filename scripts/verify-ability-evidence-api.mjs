#!/usr/bin/env node

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";
assertIsolatedVerificationRuntime();

import assert from "node:assert/strict";

const DEFAULT_BASE_URL = "http://localhost:3001";
const REQUEST_TIMEOUT_MS = 10_000;

const baseUrl = normalizeBaseUrl(
  process.env.ABILITY_EVIDENCE_API_BASE_URL ?? process.env.API_BASE_URL ?? DEFAULT_BASE_URL,
);
const suffix = new Date().toISOString().replace(/[:.]/g, "-");

const rootNodeName = `verify-evidence-root-${suffix}`;
const childNodeName = `verify-evidence-child-${suffix}`;
const rootEvidenceContent = `Root evidence ${suffix}`;
const childEvidenceContent = `Child evidence ${suffix}`;
const reviewedChildContent = `Reviewed child evidence ${suffix}`;

try {
  logStep(`Using base URL: ${baseUrl}`);

  const createdRootNode = expectSuccessEnvelope(
    (await requestJson("/api/ability-nodes", {
      method: "POST",
      body: {
        name: rootNodeName,
        description: "ability-evidence verification root",
      },
    })).payload,
    "POST /api/ability-nodes root",
  );
  logPass(`POST /api/ability-nodes created root id=${createdRootNode.id}`);

  const createdChildNode = expectSuccessEnvelope(
    (await requestJson("/api/ability-nodes", {
      method: "POST",
      body: {
        name: childNodeName,
        parentId: createdRootNode.id,
      },
    })).payload,
    "POST /api/ability-nodes child",
  );
  logPass(`POST /api/ability-nodes created child id=${createdChildNode.id}`);

  const projectIdsResponse = await requestJson("/api/ability-evidence", {
    method: "POST",
    body: {
      abilityNodeId: createdRootNode.id,
      content: "should reject projectIds",
      impact: "positive",
      difficultyScore: 3,
      independenceScore: 3,
      impactScore: 3,
      feedbackScore: 1,
      projectIds: ["00000000-0000-0000-0000-000000000000"],
    },
  });
  assert.equal(projectIdsResponse.status, 400, `projectIds should be rejected with 400, got ${projectIdsResponse.status}`);
  expectErrorEnvelope(projectIdsResponse.payload, "POST /api/ability-evidence with projectIds");
  logPass("POST /api/ability-evidence rejected unsupported projectIds");

  const createdRootEvidence = expectSuccessEnvelope(
    (await requestJson("/api/ability-evidence", {
      method: "POST",
      body: {
        abilityNodeId: createdRootNode.id,
        content: `  ${rootEvidenceContent}  `,
        impact: "positive",
        difficultyScore: 4,
        independenceScore: 3,
        impactScore: 5,
        feedbackScore: 2,
      },
    })).payload,
    "POST /api/ability-evidence root",
  );
  assert.equal(createdRootEvidence.abilityNodeId, createdRootNode.id, "root evidence node id should match root node");
  assert.equal(createdRootEvidence.content, rootEvidenceContent, "root evidence content should be trimmed");
  assert.equal(createdRootEvidence.status, "candidate", "root evidence status should default to candidate");
  assert.equal(createdRootEvidence.recurrenceCount, 1, "root evidence recurrenceCount should default to 1");
  logPass(`POST /api/ability-evidence created root evidence id=${createdRootEvidence.id}`);

  const createdChildEvidence = expectSuccessEnvelope(
    (await requestJson("/api/ability-evidence", {
      method: "POST",
      body: {
        abilityNodeId: createdChildNode.id,
        content: childEvidenceContent,
        impact: "neutral",
        difficultyScore: 2,
        independenceScore: 4,
        impactScore: 3,
        feedbackScore: 0,
        recurrenceCount: 2,
      },
    })).payload,
    "POST /api/ability-evidence child",
  );
  assert.equal(createdChildEvidence.abilityNodeId, createdChildNode.id, "child evidence node id should match child node");
  assert.equal(createdChildEvidence.status, "candidate", "child evidence status should default to candidate");
  assert.equal(createdChildEvidence.recurrenceCount, 2, "child evidence recurrenceCount should reflect explicit value");
  logPass(`POST /api/ability-evidence created child evidence id=${createdChildEvidence.id}`);

  const listCandidateResponse = expectSuccessEnvelope(
    (await requestJson(
      `/api/ability-evidence?abilityNodeId=${createdRootNode.id}&status=candidate&limit=10&offset=0`,
    )).payload,
    "GET /api/ability-evidence candidate list",
  );
  assert.equal(listCandidateResponse.pagination.limit, 10, "candidate list should echo limit");
  assert.equal(listCandidateResponse.pagination.offset, 0, "candidate list should echo offset");
  assert.ok(
    listCandidateResponse.items.some((item) => item.id === createdRootEvidence.id),
    "candidate list should include root evidence",
  );
  assert.ok(
    listCandidateResponse.items.every((item) => item.abilityNodeId === createdRootNode.id),
    "candidate list should only include requested node items",
  );
  logPass("GET /api/ability-evidence filtered by abilityNodeId and status");

  const fetchedChildEvidence = expectSuccessEnvelope(
    (await requestJson(`/api/ability-evidence/${createdChildEvidence.id}`)).payload,
    `GET /api/ability-evidence/${createdChildEvidence.id}`,
  );
  assert.equal(
    fetchedChildEvidence.id,
    createdChildEvidence.id,
    "GET /api/ability-evidence/:id should return the requested evidence",
  );
  logPass("GET /api/ability-evidence/:id returned the requested evidence");

  const fetchedRootNodeTree = expectSuccessEnvelope(
    (await requestJson(`/api/ability-nodes/${createdRootNode.id}`)).payload,
    `GET /api/ability-nodes/${createdRootNode.id}`,
  );
  assert.equal(fetchedRootNodeTree.evidenceItems.length, 1, "root node detail should include direct evidenceItems");
  assert.equal(
    fetchedRootNodeTree.evidenceItems[0].id,
    createdRootEvidence.id,
    "root node detail should include root evidence",
  );
  assert.equal(fetchedRootNodeTree.children.length, 1, "root node detail should include child node");
  assert.equal(
    fetchedRootNodeTree.children[0].evidenceItems[0].id,
    createdChildEvidence.id,
    "child subtree should include child evidence",
  );
  logPass("GET /api/ability-nodes/:id included direct and child evidenceItems");

  const listedTree = expectSuccessEnvelope(
    (await requestJson("/api/ability-nodes")).payload,
    "GET /api/ability-nodes",
  );
  const listedRootNode = listedTree.items.find((item) => item.id === createdRootNode.id);
  assert.ok(listedRootNode, "tree list should include verification root node");
  assert.equal(listedRootNode.evidenceItems[0].id, createdRootEvidence.id, "tree list root should include root evidence");
  assert.equal(
    listedRootNode.children[0].evidenceItems[0].id,
    createdChildEvidence.id,
    "tree list child should include child evidence",
  );
  logPass("GET /api/ability-nodes tree included evidenceItems on nested nodes");

  const reviewedChildEvidence = expectSuccessEnvelope(
    (await requestJson(`/api/ability-evidence/${createdChildEvidence.id}/review`, {
      method: "PATCH",
      body: {
        status: "confirmed",
        content: `  ${reviewedChildContent}  `,
        impact: "positive",
        difficultyScore: 5,
        independenceScore: 5,
        impactScore: 4,
        feedbackScore: 2,
        recurrenceCount: 3,
      },
    })).payload,
    `PATCH /api/ability-evidence/${createdChildEvidence.id}/review`,
  );
  assert.equal(reviewedChildEvidence.status, "confirmed", "review should update status to confirmed");
  assert.equal(reviewedChildEvidence.content, reviewedChildContent, "review should trim updated content");
  assert.equal(reviewedChildEvidence.recurrenceCount, 3, "review should update recurrenceCount");
  logPass("PATCH /api/ability-evidence/:id/review confirmed and updated the evidence");

  const listConfirmedResponse = expectSuccessEnvelope(
    (await requestJson(
      `/api/ability-evidence?abilityNodeId=${createdChildNode.id}&status=confirmed&limit=10&offset=0`,
    )).payload,
    "GET /api/ability-evidence confirmed list",
  );
  assert.ok(
    listConfirmedResponse.items.some((item) => item.id === createdChildEvidence.id),
    "confirmed list should include the reviewed child evidence",
  );
  logPass("GET /api/ability-evidence returned reviewed evidence under confirmed status");

  const deleteResponse = await requestJson(`/api/ability-evidence/${createdChildEvidence.id}`, {
    method: "DELETE",
  });
  assert.equal(deleteResponse.status, 204, `DELETE /api/ability-evidence/:id should return 204, got ${deleteResponse.status}`);
  assert.equal(deleteResponse.payload, null, "204 delete response should not include a JSON body");
  logPass("DELETE /api/ability-evidence/:id returned 204");

  const deletedFetchResponse = await requestJson(`/api/ability-evidence/${createdChildEvidence.id}`);
  assert.equal(
    deletedFetchResponse.status,
    404,
    `GET deleted ability evidence should return 404, got ${deletedFetchResponse.status}`,
  );
  const deletedFetchPayload = expectErrorEnvelope(
    deletedFetchResponse.payload,
    `GET /api/ability-evidence/${createdChildEvidence.id} after delete`,
  );
  assert.match(
    deletedFetchPayload.error.message,
    /not found/i,
    "deleted ability evidence fetch should mention not found",
  );
  logPass("GET /api/ability-evidence/:id after delete returned 404");

  logPass("AbilityEvidence API verification completed");
} catch (error) {
  logFail(formatError(error));
  process.exit(1);
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
  console.log(`[verify:ability-evidence] ${message}`);
}

function logPass(message) {
  console.log(`[verify:ability-evidence] PASS ${message}`);
}

function logFail(message) {
  console.error(`[verify:ability-evidence] FAIL ${message}`);
}
