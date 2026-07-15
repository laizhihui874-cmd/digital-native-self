#!/usr/bin/env node
import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";
assertIsolatedVerificationRuntime();
import assert from "node:assert/strict";
const baseUrl = process.env.API_BASE_URL;
const stamp = Date.now();
const person = await request("/api/people", { method: "POST", body: { name: `人物验收 ${stamp}`, relationship: "长期朋友", description: "共同经历重要转折", firstMetAt: "2018-01-01T00:00:00.000Z" } });
assert.equal(person.relationship, "长期朋友");
assert.ok((await request("/api/people")).some((item) => item.id === person.id));
const artifact = await request("/api/evidence/artifacts/text", { method: "POST", body: { title: "人物关系来源", content: "共同完成一次重要项目。" } });
const candidate = await request("/api/event-candidates", { method: "POST", body: { evidenceFragmentId: artifact.revisions[0].fragments[0].id, title: `共同项目 ${stamp}`, eventType: "project", occurredAt: "2020-01-01T00:00:00.000Z", timePrecision: "day" } });
const event = (await request(`/api/event-candidates/${candidate.id}/review`, { method: "PATCH", body: { status: "confirmed" } })).confirmedEvent;
const relation = await request("/api/graph-relations", { method: "POST", body: { sourceType: "person", sourceId: person.id, targetType: "event", targetId: event.id, relationType: "participated", label: "共同参与" } });
const graph = await request("/api/life-graph/subgraph?limit=400");
assert.ok(graph.nodes.some((node) => node.id === `person:${person.id}`));
assert.ok(graph.edges.some((edge) => edge.graphRelationId === relation.id && edge.label === "共同参与"));
await request(`/api/people/${person.id}`, { method: "DELETE", expectedStatus: 204 });
assert.equal((await request("/api/graph-relations")).some((item) => item.id === relation.id), false);
console.log("PASS Person archive and graph relation verification completed");

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, { method: options.method ?? "GET", headers: options.method === "DELETE" ? undefined : { "content-type": "application/json" }, body: options.body ? JSON.stringify(options.body) : undefined });
  if (options.expectedStatus === 204) { assert.equal(response.status, 204); return null; }
  const payload = await response.json(); assert.equal(response.ok, true, JSON.stringify(payload)); return payload.data;
}
