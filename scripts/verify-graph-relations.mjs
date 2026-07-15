#!/usr/bin/env node

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";
assertIsolatedVerificationRuntime();

import assert from "node:assert/strict";
const baseUrl = (process.env.API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/+$/, "");
const stamp = Date.now();

const firstEvent = await createConfirmedEvent(`关系起点 ${stamp}`, "2020-05-01T12:00:00.000Z");
const secondEvent = await createConfirmedEvent(`关系终点 ${stamp}`, "2021-06-01T12:00:00.000Z");
const relation = await request("/api/graph-relations", {
  method: "POST",
  body: {
    sourceType: "event", sourceId: firstEvent.id,
    targetType: "event", targetId: secondEvent.id,
    relationType: "influenced", label: "影响了后续选择", status: "confirmed",
    validFrom: "2022-01-01T00:00:00.000Z", validTo: "2024-01-01T00:00:00.000Z",
  },
});
assert.equal(relation.label, "影响了后续选择");

const graph2021 = await request("/api/life-graph/subgraph?asOf=2021-12-31&limit=400");
assert.equal(graph2021.edges.some((edge) => edge.graphRelationId === relation.id), false);
const graph2023 = await request("/api/life-graph/subgraph?asOf=2023-06-01&limit=400");
assert.equal(graph2023.edges.some((edge) => edge.graphRelationId === relation.id && edge.provenance === "manual_relation"), true);
const graph2025 = await request("/api/life-graph/subgraph?asOf=2025-01-01&limit=400");
assert.equal(graph2025.edges.some((edge) => edge.graphRelationId === relation.id), false);

const updated = await request(`/api/graph-relations/${relation.id}`, { method: "PATCH", body: { label: "后来重新理解为间接影响" } });
assert.equal(updated.label, "后来重新理解为间接影响");
await request(`/api/graph-relations/${relation.id}`, { method: "DELETE", expectedStatus: 204 });
const graphAfterDelete = await request("/api/life-graph/subgraph?limit=400");
assert.equal(graphAfterDelete.edges.some((edge) => edge.graphRelationId === relation.id), false);

console.log("PASS Manual graph relation and as-of filtering verification completed");

async function createConfirmedEvent(title, occurredAt) {
  const artifact = await request("/api/evidence/artifacts/text", { method: "POST", body: { title, content: `${title} 的原始来源` } });
  const candidate = await request("/api/event-candidates", { method: "POST", body: {
    evidenceFragmentId: artifact.revisions[0].fragments[0].id, title, eventType: "other", occurredAt, timePrecision: "day",
  } });
  const confirmed = await request(`/api/event-candidates/${candidate.id}/review`, { method: "PATCH", body: { status: "confirmed" } });
  return confirmed.confirmedEvent;
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? "GET",
    headers: options.method === "DELETE" ? undefined : { "content-type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  if (options.expectedStatus === 204) { assert.equal(response.status, 204); return null; }
  const payload = await response.json();
  assert.equal(response.status >= 200 && response.status < 300, true, JSON.stringify(payload));
  assert.equal(payload.error, null);
  return payload.data;
}
