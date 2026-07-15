#!/usr/bin/env node

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";
assertIsolatedVerificationRuntime();

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access } from "node:fs/promises";
import path from "node:path";

const baseUrl = (process.env.API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/+$/, "");
const stamp = new Date().toISOString();
const originalContent = `2026-07-14 我完成了档案主链的第一次隔离验证。${stamp}`;

const uploadedContent = `历史文件原文不会被解析结果覆盖。${stamp}`;
const uploadForm = new FormData();
uploadForm.set(
  "file",
  new Blob([uploadedContent], { type: "text/plain" }),
  `archive-verification-${Date.now()}.txt`,
);
const uploadedArtifact = await requestMultipart("/api/evidence/artifacts/file", uploadForm);
assert.equal(uploadedArtifact.artifactType, "uploaded_file");
assert.equal(uploadedArtifact.revisions.length, 2);
assert.equal(uploadedArtifact.revisions[0].revisionType, "original");
assert.equal(uploadedArtifact.revisions[0].content, uploadedContent);
assert.equal(uploadedArtifact.revisions[0].contentHash, createHash("sha256").update(uploadedContent).digest("hex"));
assert.equal(uploadedArtifact.revisions[1].revisionType, "parsed");
assert.equal(uploadedArtifact.revisions[1].content, uploadedContent);
assert.equal(uploadedArtifact.revisions[1].fragments[0].content, uploadedContent);
assert.ok(uploadedArtifact.revisions[0].storagePath);
await access(path.resolve(uploadedArtifact.revisions[0].storagePath));

const artifact = await request("/api/evidence/artifacts/text", {
  method: "POST",
  body: { title: `档案验证 ${stamp}`, content: originalContent, capturedAt: "2026-07-14T09:00:00.000Z" },
});
assert.equal(artifact.revisions.length, 1);
assert.equal(artifact.revisions[0].revisionType, "original");
assert.equal(artifact.revisions[0].contentHash, createHash("sha256").update(originalContent).digest("hex"));
assert.equal(artifact.revisions[0].fragments[0].content, originalContent);
const fragmentId = artifact.revisions[0].fragments[0].id;

const parsedContent = `解析后文本：${originalContent}`;
const reparsedArtifact = await request(`/api/evidence/artifacts/${artifact.id}/revisions/parsed`, {
  method: "POST",
  body: { content: parsedContent, parserVersion: "verify-parser/1" },
});
assert.equal(reparsedArtifact.revisions.length, 2);
assert.equal(reparsedArtifact.revisions[0].content, originalContent);
assert.equal(reparsedArtifact.revisions[0].contentHash, artifact.revisions[0].contentHash);
assert.equal(reparsedArtifact.revisions[1].revisionType, "parsed");
assert.equal(reparsedArtifact.revisions[1].content, parsedContent);

const candidate = await request("/api/event-candidates", {
  method: "POST",
  body: {
    evidenceFragmentId: fragmentId,
    title: "完成档案主链验证",
    description: "原始候选描述",
    eventType: "project",
    occurredAt: "2026-07-14T09:00:00.000Z",
    timePrecision: "day",
  },
});
assert.equal(candidate.status, "candidate");
assert.equal(candidate.confirmedEvent, null);

const confirmed = await request(`/api/event-candidates/${candidate.id}/review`, {
  method: "PATCH",
  body: { status: "confirmed", title: "确认后的档案事件", timePrecision: "day" },
});
assert.equal(confirmed.status, "confirmed");
assert.equal(confirmed.confirmedEvent.title, "确认后的档案事件");
assert.equal(confirmed.confirmedEvent.revisions.length, 1);
assert.equal(confirmed.confirmedEvent.sources[0].evidenceFragment.content, originalContent);
assert.equal(confirmed.confirmedEvent.sources[0].evidenceFragment.revision.artifact.id, artifact.id);

const eventId = confirmed.confirmedEvent.id;
const revised = await request(`/api/events/${eventId}`, {
  method: "PATCH",
  body: { title: "修正后的档案事件", changeReason: "验证事件版本历史" },
});
assert.equal(revised.revisions.length, 2);
assert.equal(revised.revisions[0].title, "确认后的档案事件");
assert.equal(revised.revisions[1].title, "修正后的档案事件");
assert.equal(revised.sources[0].evidenceFragment.content, originalContent);

const memoryCandidate = await request(`/api/events/${eventId}/memory-candidates`, {
  method: "POST",
  body: {
    content: "我会先用可追溯的小闭环验证复杂产品。",
    memoryType: "value",
    confidence: 0.8,
  },
});
assert.equal(memoryCandidate.status, "candidate");
assert.equal(memoryCandidate.versions.length, 1);
assert.equal(memoryCandidate.evidenceSources[0].evidenceFragment.content, originalContent);

const graphBeforeMemoryConfirmation = await request("/api/life-graph/subgraph");
assert.equal(
  graphBeforeMemoryConfirmation.nodes.some((node) => node.entityId === memoryCandidate.id),
  false,
  "candidate memory should not enter the default graph",
);

const confirmedMemoryContent = "我会先用可追溯的小闭环验证复杂产品，再继续扩展。";
await request(`/api/memories/${memoryCandidate.id}/review`, {
  method: "PATCH",
  body: {
    status: "confirmed",
    content: confirmedMemoryContent,
    memoryType: "value",
    changeReason: "验证人工修正后的记忆版本",
  },
});
const memoryDetail = await request(`/api/memories/${memoryCandidate.id}/archive-detail`);
assert.equal(memoryDetail.status, "confirmed");
assert.equal(memoryDetail.versions.length, 2);
assert.equal(memoryDetail.versions[0].newContent, memoryCandidate.content);
assert.equal(memoryDetail.versions[1].newContent, confirmedMemoryContent);
assert.equal(memoryDetail.evidenceSources[0].evidenceFragment.revision.artifact.id, artifact.id);

const graphAfterMemoryConfirmation = await request("/api/life-graph/subgraph");
const memoryNode = graphAfterMemoryConfirmation.nodes.find((node) => node.entityId === memoryCandidate.id);
assert.equal(memoryNode.source.sourceType, "evidence_fragment");
assert.ok(
  graphAfterMemoryConfirmation.edges.some(
    (edge) => edge.source === `event:${eventId}` && edge.target === `memory:${memoryCandidate.id}`,
  ),
  "confirmed memory should be linked to its source event",
);

const artifactAfterReview = await request(`/api/evidence/artifacts/${artifact.id}`);
assert.equal(artifactAfterReview.revisions.length, 2);
assert.equal(artifactAfterReview.revisions[0].content, originalContent);
assert.equal(artifactAfterReview.revisions[1].content, parsedContent);

await request(`/api/event-candidates/${candidate.id}/review`, {
  method: "PATCH",
  body: { status: "rejected" },
  expectedStatus: 409,
});

console.log("PASS Evidence -> candidate -> confirmed event -> revision provenance verification completed");

async function requestMultipart(pathname, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json();
  assert.equal(response.status >= 200 && response.status < 300, true, JSON.stringify(payload));
  assert.equal(payload.error, null);
  return payload.data;
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json();
  if (options.expectedStatus) {
    assert.equal(response.status, options.expectedStatus, JSON.stringify(payload));
    return payload;
  }
  assert.equal(response.status >= 200 && response.status < 300, true, JSON.stringify(payload));
  assert.equal(payload.error, null);
  return payload.data;
}
