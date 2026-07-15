#!/usr/bin/env node

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";

assertIsolatedVerificationRuntime();
const baseUrl = (process.env.API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/+$/, "");
const apiRequire = createRequire(new URL("../apps/api/package.json", import.meta.url));
const { PrismaClient } = apiRequire("@prisma/client");
const prisma = new PrismaClient();
const stamp = `review-items-${Date.now()}`;

try {
  const legacyCountBefore = await prisma.eventCandidate.count();
  const artifact = await request("/api/evidence/artifacts/text", {
    method: "POST",
    body: { title: `${stamp} 原始资料`, content: `${stamp} 完成统一候选接口验证。`, capturedAt: "2026-07-15T08:00:00.000Z" },
  });
  const candidate = await request("/api/event-candidates", {
    method: "POST",
    body: {
      evidenceFragmentId: artifact.revisions[0].fragments[0].id,
      title: `${stamp} 事件建议`,
      description: `${stamp} 事件描述`,
      eventType: "project",
      occurredAt: "2026-07-15T08:00:00.000Z",
      timePrecision: "day",
      confidence: 0.82,
    },
  });
  const proposal = await prisma.proposal.findUnique({ where: { id: candidate.id } });
  assert.equal(proposal?.proposalType, "event");
  assert.equal(proposal?.evidenceFragmentId, artifact.revisions[0].fragments[0].id);
  assert.equal(await prisma.eventCandidate.count(), legacyCountBefore, "new event candidates must not write the legacy table");

  const memory = await request("/api/memories", {
    method: "POST",
    body: { memoryType: "value", content: `${stamp} 候选记忆`, status: "candidate", confidence: 0.7 },
  });
  const node = await request("/api/ability-nodes", { method: "POST", body: { name: `${stamp} 能力` } });
  const ability = await request("/api/ability-evidence", {
    method: "POST",
    body: { abilityNodeId: node.id, content: `${stamp} 候选能力证据`, impact: "positive", difficultyScore: 3, independenceScore: 4, impactScore: 4, feedbackScore: 1 },
  });
  const duplicateMemoryA = await request("/api/memories", { method: "POST", body: { memoryType: "event", content: `${stamp} 完全相同内容`, status: "candidate", confidence: 0.61 } });
  const duplicateMemoryB = await request("/api/memories", { method: "POST", body: { memoryType: "event", content: `  ${stamp}   完全相同内容  `, status: "candidate", confidence: 0.62 } });

  const inbox = await request("/api/review-items?status=candidate&limit=100&offset=0");
  assert.ok(inbox.items.some((item) => item.kind === "proposal" && item.id === candidate.id));
  assert.ok(inbox.items.some((item) => item.kind === "memory" && item.id === memory.id));
  assert.ok(inbox.items.some((item) => item.kind === "ability_evidence" && item.id === ability.id));
  assert.ok(inbox.counts.proposal >= 1 && inbox.counts.memory >= 1 && inbox.counts.ability_evidence >= 1);
  assert.equal(inbox.globalPendingCount, inbox.counts.proposal + inbox.counts.memory + inbox.counts.ability_evidence);
  assert.equal(inbox.filteredCount, inbox.pagination.total);
  const duplicateItems = inbox.items.filter((item) => item.id === duplicateMemoryA.id || item.id === duplicateMemoryB.id);
  assert.equal(duplicateItems.length, 2);
  assert.equal(duplicateItems[0].duplicateGroupId, duplicateItems[1].duplicateGroupId);
  assert.equal(duplicateItems[0].duplicateCount, 2);

  const sourceItem = inbox.items.find((item) => item.id === candidate.id);
  assert.ok(sourceItem?.source?.type);
  const sourceSearch = await request(`/api/review-items?query=${encodeURIComponent(`${stamp} 原始资料`)}&sourceType=${encodeURIComponent(sourceItem.source.type)}&dateFrom=2026-07-15T00:00:00.000Z&dateTo=2026-07-16T00:00:00.000Z&limit=100`);
  assert.ok(sourceSearch.items.some((item) => item.id === candidate.id), "search must include source title");
  assert.ok(sourceSearch.items.every((item) => item.source?.type === sourceItem.source.type));
  assert.ok(sourceSearch.filteredCount < sourceSearch.globalPendingCount);
  const confidenceSorted = await request("/api/review-items?minConfidence=0.6&sort=confidence_desc&limit=100");
  assert.ok(confidenceSorted.items.every((item) => item.confidence >= 0.6));
  for (let index = 1; index < confidenceSorted.items.length; index += 1) {
    assert.ok(confidenceSorted.items[index - 1].confidence >= confidenceSorted.items[index].confidence);
  }
  const pageOne = await request("/api/review-items?sort=oldest&limit=1&offset=0");
  const pageTwo = await request("/api/review-items?sort=oldest&limit=1&offset=1");
  assert.equal(pageOne.items.length, 1);
  assert.equal(pageTwo.items.length, 1);
  assert.notEqual(pageOne.items[0].id, pageTwo.items[0].id);

  const foreignUser = await prisma.user.create({ data: { displayName: `${stamp} other user` } });
  const foreignProposal = await prisma.proposal.create({
    data: {
      userId: foreignUser.id,
      proposalType: "event",
      title: `${stamp} foreign`,
      payload: { eventType: "other", occurredAt: "2026-07-15T08:00:00.000Z", timePrecision: "day", description: null },
    },
  });
  const inboxAfterForeign = await request("/api/review-items?kind=proposal&status=candidate&limit=100&offset=0");
  assert.equal(inboxAfterForeign.items.some((item) => item.id === foreignProposal.id), false);
  await request(`/api/review-items/proposal/${foreignProposal.id}`, { method: "PATCH", body: { status: "rejected" }, expectedStatus: 404 });

  const partialMemory = await request("/api/memories", { method: "POST", body: { memoryType: "value", content: `${stamp} 批量部分成功`, status: "candidate" } });
  const emptyProposal = await prisma.proposal.create({
    data: { userId: proposal.userId, proposalType: "event", title: "", summary: "", payload: { eventType: "other", occurredAt: "2026-07-15T08:00:00.000Z", timePrecision: "day", description: "" }, evidenceFragmentId: artifact.revisions[0].fragments[0].id },
  });
  const partial = await request("/api/review-items/bulk-review", {
    method: "POST",
    body: { status: "confirmed", items: [{ kind: "memory", id: partialMemory.id }, { kind: "proposal", id: emptyProposal.id }] },
  });
  assert.deepEqual(partial.summary, { requested: 2, succeeded: 1, failed: 1 });
  assert.equal(partial.results.find((item) => item.id === emptyProposal.id).ok, false);
  assert.equal((await request(`/api/memories/${partialMemory.id}`)).status, "confirmed");
  assert.equal((await prisma.proposal.findUnique({ where: { id: emptyProposal.id } })).status, "candidate");

  const absentId = randomUUID();
  const hundred = await request("/api/review-items/bulk-review", { method: "POST", body: { status: "rejected", items: Array.from({ length: 100 }, () => ({ kind: "memory", id: absentId })) } });
  assert.deepEqual(hundred.summary, { requested: 100, succeeded: 0, failed: 100 });
  await request("/api/review-items/bulk-review", { method: "POST", body: { status: "rejected", items: Array.from({ length: 101 }, () => ({ kind: "memory", id: absentId })) }, expectedStatus: 400 });

  const confirmedProposal = await request(`/api/review-items/proposal/${candidate.id}`, {
    method: "PATCH",
    body: { status: "confirmed", title: `${stamp} 已确认事件`, content: `${stamp} 已确认描述` },
  });
  assert.equal(confirmedProposal.status, "confirmed");
  const eventCandidate = await request(`/api/event-candidates/${candidate.id}`);
  assert.equal(eventCandidate.status, "confirmed");
  assert.equal(eventCandidate.confirmedEvent.title, `${stamp} 已确认事件`);
  assert.equal(await prisma.proposalReview.count({ where: { proposalId: candidate.id, toStatus: "confirmed" } }), 1);
  assert.equal(await prisma.eventCandidate.count(), legacyCountBefore, "review must not write the legacy table");
  const firstConfirmedEventId = eventCandidate.confirmedEvent.id;
  const undoneProposal = await request(`/api/review-items/proposal/${candidate.id}/undo`, { method: "POST" });
  assert.equal(undoneProposal.status, "candidate");
  assert.equal(await prisma.event.count({ where: { id: firstConfirmedEventId } }), 0);
  await request(`/api/review-items/proposal/${candidate.id}`, { method: "PATCH", body: { status: "confirmed" } });

  const confirmedMemory = await request(`/api/review-items/memory/${memory.id}`, {
    method: "PATCH",
    body: { status: "confirmed", content: `${stamp} 修改后的正式记忆`, note: "统一入口验收" },
  });
  assert.equal(confirmedMemory.status, "confirmed");
  assert.equal((await request(`/api/memories/${memory.id}`)).content, `${stamp} 修改后的正式记忆`);
  const undoneMemory = await request(`/api/review-items/memory/${memory.id}/undo`, { method: "POST" });
  assert.equal(undoneMemory.status, "candidate");
  assert.ok(await prisma.reviewItemHistory.count({ where: { itemId: memory.id } }) >= 2);
  await request(`/api/review-items/memory/${memory.id}`, { method: "PATCH", body: { status: "confirmed" } });

  const rejectedAbility = await request(`/api/review-items/ability_evidence/${ability.id}`, {
    method: "PATCH",
    body: { status: "rejected", content: `${stamp} 已拒绝能力证据` },
  });
  assert.equal(rejectedAbility.status, "rejected");
  assert.equal((await request(`/api/ability-evidence/${ability.id}`)).status, "rejected");
  const undoneAbility = await request(`/api/review-items/ability_evidence/${ability.id}/undo`, { method: "POST" });
  assert.equal(undoneAbility.status, "candidate");
  await request(`/api/review-items/ability_evidence/${ability.id}`, { method: "PATCH", body: { status: "rejected" } });

  const rejectedProposal = await request("/api/event-candidates", { method: "POST", body: { evidenceFragmentId: artifact.revisions[0].fragments[0].id, title: `${stamp} 拒绝后撤销`, description: "正文", eventType: "other", occurredAt: "2026-07-15T08:00:00.000Z", timePrecision: "day" } });
  await request(`/api/review-items/proposal/${rejectedProposal.id}`, { method: "PATCH", body: { status: "rejected" } });
  assert.equal((await request(`/api/review-items/proposal/${rejectedProposal.id}/undo`, { method: "POST" })).status, "candidate");

  const blockedProposal = await request("/api/event-candidates", { method: "POST", body: { evidenceFragmentId: artifact.revisions[0].fragments[0].id, title: `${stamp} 有下游引用`, description: "正文", eventType: "other", occurredAt: "2026-07-15T08:00:00.000Z", timePrecision: "day" } });
  await request(`/api/review-items/proposal/${blockedProposal.id}`, { method: "PATCH", body: { status: "confirmed" } });
  const blockedDetail = await request(`/api/event-candidates/${blockedProposal.id}`);
  await prisma.sourceCitation.create({ data: { userId: proposal.userId, sourceType: "event", sourceId: blockedDetail.confirmedEvent.id, title: `${stamp} 下游引用` } });
  const blockedUndo = await request(`/api/review-items/proposal/${blockedProposal.id}/undo`, { method: "POST", expectedStatus: 409 });
  assert.match(blockedUndo.error.message, /下游引用/);
  assert.equal((await request(`/api/event-candidates/${blockedProposal.id}`)).status, "confirmed");

  await request(`/api/review-items/memory/${duplicateMemoryA.id}/undo`, { method: "POST", expectedStatus: 409 });

  const archive = await request("/api/data-control/archive-export");
  assert.ok(archive.collections.proposals.some((item) => item.id === candidate.id));
  assert.ok(archive.collections.proposalReviews.some((item) => item.proposalId === candidate.id));
  assert.equal(Array.isArray(archive.collections.eventCandidates), true);

  console.log("PASS Proposal-only event writes, unified review items, ownership and archive export verification completed");
} finally {
  await prisma.$disconnect();
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
  assert.equal(response.ok, true, JSON.stringify(payload));
  assert.equal(payload.error, null);
  return payload.data;
}
