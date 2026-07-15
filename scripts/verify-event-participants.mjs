#!/usr/bin/env node
import assert from "node:assert/strict";
import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";

assertIsolatedVerificationRuntime();
const baseUrl = process.env.API_BASE_URL;
const stamp = Date.now();

const person = await request("/api/people", {
  method: "POST",
  body: { name: `参与者 ${stamp}`, relationship: "共同创作者" },
});
const artifact = await request("/api/evidence/artifacts/text", {
  method: "POST",
  body: { title: "人物参与事件来源", content: "2020 年，我们一起完成了人生档案的第一版。" },
});
const fragmentId = artifact.revisions[0].fragments[0].id;
const candidate = await request("/api/event-candidates", {
  method: "POST",
  body: {
    evidenceFragmentId: fragmentId,
    title: `共同完成档案 ${stamp}`,
    eventType: "project",
    occurredAt: "2020-06-01T00:00:00.000Z",
    timePrecision: "day",
  },
});
const reviewed = await request(`/api/event-candidates/${candidate.id}/review`, {
  method: "PATCH",
  body: { status: "confirmed" },
});
const event = reviewed.confirmedEvent;

await request(`/api/events/${event.id}/participants`, {
  method: "POST",
  expectedStatus: 400,
  body: {
    personId: person.id,
    role: "共同创作者",
    validFrom: "2021-01-01T00:00:00.000Z",
    validTo: "2020-01-01T00:00:00.000Z",
  },
});

const participant = await request(`/api/events/${event.id}/participants`, {
  method: "POST",
  body: {
    personId: person.id,
    role: "共同创作者",
    description: "共同设计并完成第一版",
    validFrom: "2020-01-01T00:00:00.000Z",
    validTo: "2021-01-01T00:00:00.000Z",
  },
});
assert.equal(participant.evidenceFragmentId, fragmentId, "应自动继承事件的原始来源片段");
assert.ok((await request(`/api/events/${event.id}`)).participants.some((item) => item.id === participant.id));

const graphDuring = await request("/api/life-graph/subgraph?asOf=2020-07-01&limit=400");
const graphEdge = graphDuring.edges.find((edge) => edge.eventParticipantId === participant.id);
assert.equal(graphEdge?.relationType, "participated_in_event");
assert.equal(graphEdge?.label, "共同创作者");
assert.equal(graphEdge?.provenance, "evidence_fragment");
assert.equal(graphEdge?.citationId, fragmentId);

const graphAfter = await request("/api/life-graph/subgraph?asOf=2021-07-01&limit=400");
assert.equal(graphAfter.edges.some((edge) => edge.eventParticipantId === participant.id), false);

const updated = await request(`/api/event-participants/${participant.id}`, {
  method: "PATCH",
  body: { role: "联合发起人" },
});
assert.equal(updated.role, "联合发起人");
await request(`/api/event-participants/${participant.id}`, { method: "DELETE", expectedStatus: 204 });
assert.equal((await request(`/api/events/${event.id}/participants`)).length, 0);

console.log("PASS Source-backed event participation and life graph verification completed");

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? "GET",
    headers: options.method === "DELETE" ? undefined : { "content-type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const expectedStatus = options.expectedStatus;
  if (expectedStatus) {
    assert.equal(response.status, expectedStatus);
    if (expectedStatus === 204) return null;
    return response.json();
  }
  const payload = await response.json();
  assert.equal(response.ok, true, JSON.stringify(payload));
  return payload.data;
}
