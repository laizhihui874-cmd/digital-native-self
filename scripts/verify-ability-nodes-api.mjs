#!/usr/bin/env node

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";
assertIsolatedVerificationRuntime();

import assert from "node:assert/strict";

const DEFAULT_BASE_URL = "http://localhost:3001";
const REQUEST_TIMEOUT_MS = 10_000;

const baseUrl = normalizeBaseUrl(
  process.env.ABILITY_NODES_API_BASE_URL ?? process.env.API_BASE_URL ?? DEFAULT_BASE_URL,
);
const suffix = new Date().toISOString().replace(/[:.]/g, "-");

const rootName = `verify-root-a-${suffix}`;
const rootBName = `verify-root-b-${suffix}`;
const childName = `verify-child-${suffix}`;
const siblingName = `verify-sibling-${suffix}`;
const grandchildName = `verify-grandchild-${suffix}`;
const renamedChildName = `verify-child-renamed-${suffix}`;

try {
  logStep(`Using base URL: ${baseUrl}`);

  const createdRoot = expectSuccessEnvelope(
    (await requestJson("/api/ability-nodes", {
      method: "POST",
      body: {
        name: `  ${rootName}  `,
        description: "root node for ability-nodes verification",
      },
    })).payload,
    "POST /api/ability-nodes root",
  );

  assert.equal(createdRoot.name, rootName, "root name should be trimmed");
  assert.equal(createdRoot.parentId, null, "root parentId should be null");
  assert.equal(createdRoot.level, 1, "root level should be 1");
  assert.equal(createdRoot.origin, "custom", "root origin should default to custom");
  assert.deepEqual(createdRoot.children, [], "new root should not have children");
  logPass(`POST /api/ability-nodes created root id=${createdRoot.id}`);

  const createdChild = expectSuccessEnvelope(
    (await requestJson("/api/ability-nodes", {
      method: "POST",
      body: {
        name: childName,
        parentId: createdRoot.id,
      },
    })).payload,
    "POST /api/ability-nodes child",
  );

  assert.equal(createdChild.parentId, createdRoot.id, "child parentId should match root id");
  assert.equal(createdChild.level, 2, "child level should be 2");
  logPass(`POST /api/ability-nodes created child id=${createdChild.id}`);

  const createdGrandchild = expectSuccessEnvelope(
    (await requestJson("/api/ability-nodes", {
      method: "POST",
      body: {
        name: grandchildName,
        parentId: createdChild.id,
      },
    })).payload,
    "POST /api/ability-nodes grandchild",
  );

  assert.equal(createdGrandchild.parentId, createdChild.id, "grandchild parentId should match child id");
  assert.equal(createdGrandchild.level, 3, "grandchild level should be 3");
  logPass(`POST /api/ability-nodes created grandchild id=${createdGrandchild.id}`);

  const createdSibling = expectSuccessEnvelope(
    (await requestJson("/api/ability-nodes", {
      method: "POST",
      body: {
        name: siblingName,
        parentId: createdRoot.id,
      },
    })).payload,
    "POST /api/ability-nodes sibling",
  );
  assert.equal(createdSibling.level, 2, "sibling level should be 2");
  logPass(`POST /api/ability-nodes created sibling id=${createdSibling.id}`);

  const createdRootB = expectSuccessEnvelope(
    (await requestJson("/api/ability-nodes", {
      method: "POST",
      body: {
        name: rootBName,
      },
    })).payload,
    "POST /api/ability-nodes root B",
  );
  assert.equal(createdRootB.level, 1, "root B level should be 1");
  logPass(`POST /api/ability-nodes created root B id=${createdRootB.id}`);

  const duplicateChildResponse = await requestJson("/api/ability-nodes", {
    method: "POST",
    body: {
      name: childName,
      parentId: createdRoot.id,
    },
  });
  assert.equal(
    duplicateChildResponse.status,
    409,
    `duplicate sibling create should return 409, got ${duplicateChildResponse.status}`,
  );
  const duplicateChildPayload = expectErrorEnvelope(
    duplicateChildResponse.payload,
    "POST /api/ability-nodes duplicate sibling",
  );
  assert.match(
    duplicateChildPayload.error.message,
    /already exists/i,
    "duplicate sibling create should mention existing name",
  );
  logPass("POST /api/ability-nodes duplicate sibling returned 409");

  const renamedChild = expectSuccessEnvelope(
    (await requestJson(`/api/ability-nodes/${createdChild.id}`, {
      method: "PATCH",
      body: {
        name: `  ${renamedChildName}  `,
        description: "   ",
      },
    })).payload,
    `PATCH /api/ability-nodes/${createdChild.id} rename`,
  );
  assert.equal(renamedChild.name, renamedChildName, "renamed child name should be trimmed");
  assert.equal(renamedChild.description, null, "blank description should normalize to null");
  assert.equal(renamedChild.children[0].id, createdGrandchild.id, "renamed child should preserve grandchild");
  logPass("PATCH /api/ability-nodes/:id renamed child and normalized blank description");

  const duplicateRenameResponse = await requestJson(`/api/ability-nodes/${createdChild.id}`, {
    method: "PATCH",
    body: {
      name: siblingName,
    },
  });
  assert.equal(
    duplicateRenameResponse.status,
    409,
    `duplicate rename should return 409, got ${duplicateRenameResponse.status}`,
  );
  expectErrorEnvelope(
    duplicateRenameResponse.payload,
    `PATCH /api/ability-nodes/${createdChild.id} duplicate rename`,
  );
  logPass("PATCH /api/ability-nodes/:id duplicate rename returned 409");

  const selfParentResponse = await requestJson(`/api/ability-nodes/${createdChild.id}`, {
    method: "PATCH",
    body: {
      parentId: createdChild.id,
    },
  });
  assertOkConflictOrBadRequest(
    selfParentResponse.status,
    "self parent update",
  );
  expectErrorEnvelope(
    selfParentResponse.payload,
    `PATCH /api/ability-nodes/${createdChild.id} self parent`,
  );
  logPass("PATCH /api/ability-nodes/:id self-parent was rejected");

  const descendantParentResponse = await requestJson(`/api/ability-nodes/${createdChild.id}`, {
    method: "PATCH",
    body: {
      parentId: createdGrandchild.id,
    },
  });
  assertOkConflictOrBadRequest(
    descendantParentResponse.status,
    "descendant parent update",
  );
  expectErrorEnvelope(
    descendantParentResponse.payload,
    `PATCH /api/ability-nodes/${createdChild.id} descendant parent`,
  );
  logPass("PATCH /api/ability-nodes/:id descendant-parent was rejected");

  const movedChild = expectSuccessEnvelope(
    (await requestJson(`/api/ability-nodes/${createdChild.id}`, {
      method: "PATCH",
      body: {
        parentId: createdRootB.id,
      },
    })).payload,
    `PATCH /api/ability-nodes/${createdChild.id} move`,
  );
  assert.equal(movedChild.parentId, createdRootB.id, "moved child parentId should match root B id");
  assert.equal(movedChild.level, 2, "moved child level should recalculate to 2");
  assert.equal(movedChild.children[0].id, createdGrandchild.id, "moved child should keep grandchild");
  assert.equal(movedChild.children[0].level, 3, "grandchild level should recalculate to 3");
  logPass("PATCH /api/ability-nodes/:id moved child to root B");

  const treeList = expectSuccessEnvelope(
    (await requestJson("/api/ability-nodes")).payload,
    "GET /api/ability-nodes",
  );

  assert.ok(Array.isArray(treeList.items), "ability tree list should contain items array");
  const listedRoot = treeList.items.find((item) => item.id === createdRoot.id);
  assert.ok(listedRoot, "tree list should contain created root node");
  assert.equal(listedRoot.level, 1, "listed root level should be 1");
  assert.equal(listedRoot.children.length, 1, "listed root should only contain remaining sibling after move");
  assert.equal(listedRoot.children[0].id, createdSibling.id, "listed root child should match remaining sibling");
  const listedRootB = treeList.items.find((item) => item.id === createdRootB.id);
  assert.ok(listedRootB, "tree list should contain root B");
  assert.equal(listedRootB.children.length, 1, "root B should contain moved child");
  assert.equal(listedRootB.children[0].id, createdChild.id, "root B child should match moved child");
  assert.equal(listedRootB.children[0].children[0].id, createdGrandchild.id, "moved child should retain grandchild");
  logPass("GET /api/ability-nodes returned multi-level tree structure");

  const fetchedChildTree = expectSuccessEnvelope(
    (await requestJson(`/api/ability-nodes/${createdChild.id}`)).payload,
    `GET /api/ability-nodes/${createdChild.id}`,
  );

  assert.equal(fetchedChildTree.id, createdChild.id, "GET /api/ability-nodes/:id should return requested node");
  assert.equal(fetchedChildTree.children.length, 1, "child subtree should contain one child");
  assert.equal(
    fetchedChildTree.children[0].id,
    createdGrandchild.id,
    "child subtree grandchild should match created grandchild",
  );
  logPass("GET /api/ability-nodes/:id returned the requested subtree");

  const deleteResponse = await requestJson(`/api/ability-nodes/${createdRoot.id}`, {
    method: "DELETE",
  });
  assert.equal(deleteResponse.status, 204, `DELETE /api/ability-nodes/:id should return 204, got ${deleteResponse.status}`);
  assert.equal(deleteResponse.payload, null, "204 delete response should not include a JSON body");
  logPass("DELETE /api/ability-nodes/:id returned 204");

  const deletedFetchResponse = await requestJson(`/api/ability-nodes/${createdRoot.id}`);
  assert.equal(
    deletedFetchResponse.status,
    404,
    `GET deleted ability node should return 404, got ${deletedFetchResponse.status}`,
  );
  const deletedFetchPayload = expectErrorEnvelope(
    deletedFetchResponse.payload,
    `GET /api/ability-nodes/${createdRoot.id} after delete`,
  );
  assert.match(
    deletedFetchPayload.error.message,
    /not found/i,
    "deleted ability node fetch should mention not found",
  );
  logPass("GET /api/ability-nodes/:id after delete returned 404");

  logPass("AbilityNode API verification completed");
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

function assertOkConflictOrBadRequest(status, label) {
  assert.ok(
    status === 400 || status === 409,
    `${label} should return 400 or 409, got ${status}`,
  );
}

function formatError(error) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

function logStep(message) {
  console.log(`[verify:ability-nodes] ${message}`);
}

function logPass(message) {
  console.log(`[verify:ability-nodes] PASS ${message}`);
}

function logFail(message) {
  console.error(`[verify:ability-nodes] FAIL ${message}`);
}
