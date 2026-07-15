#!/usr/bin/env node

import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildLifeGraphSubgraph } = require("../apps/api/dist/life-graph/life-graph.service.js");

const dailyEntryId = "10000000-0000-4000-8000-000000000001";
const eventId = "20000000-0000-4000-8000-000000000001";
const memoryId = "30000000-0000-4000-8000-000000000001";
const projectId = "40000000-0000-4000-8000-000000000001";
const abilityParentId = "50000000-0000-4000-8000-000000000001";
const abilityChildId = "50000000-0000-4000-8000-000000000002";
const decisionId = "60000000-0000-4000-8000-000000000001";

const dailyCitation = citation("70000000-0000-4000-8000-000000000001", "daily_entry", dailyEntryId);
const eventCitation = citation("70000000-0000-4000-8000-000000000002", "event", eventId);
const projectCitation = citation("70000000-0000-4000-8000-000000000003", "project", projectId);

const records = {
  events: [
    {
      id: eventId,
      dailyEntryId,
      title: "完成第一版人生星图",
      description: "把事件、记忆和能力连起来",
      occurredAt: new Date("2026-07-14T08:00:00.000Z"),
      createdAt: new Date("2026-07-14T08:10:00.000Z"),
      primarySourceCitation: null,
      sources: [
        {
          role: "primary",
          createdAt: new Date("2026-07-14T08:05:00.000Z"),
          evidenceFragment: {
            id: "90000000-0000-4000-8000-000000000001",
            content: "人生星图原始记录片段",
            locator: { kind: "character_range", start: 0, end: 14 },
            revision: {
              artifact: { title: "人生星图原始资料" },
            },
          },
        },
      ],
    },
  ],
  memories: [
    {
      id: memoryId,
      content: "做复杂产品时，先把真实数据链路跑通。",
      status: "confirmed",
      confidence: 0.9,
      createdAt: new Date("2026-07-14T09:00:00.000Z"),
      sourceCitation: dailyCitation,
    },
  ],
  projects: [
    {
      id: projectId,
      name: "数字原生自我",
      description: "人生档案馆与指南针",
      resumeSummary: null,
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      status: "active",
    },
  ],
  abilityNodes: [
    {
      id: abilityParentId,
      parentId: null,
      name: "产品开发",
      description: null,
      level: 2,
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
    },
    {
      id: abilityChildId,
      parentId: abilityParentId,
      name: "关系图设计",
      description: null,
      level: 1,
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
    },
  ],
  abilityEvidence: [
    {
      id: "80000000-0000-4000-8000-000000000001",
      abilityNodeId: abilityChildId,
      status: "candidate",
      createdAt: new Date("2026-07-14T09:30:00.000Z"),
      sourceCitation: eventCitation,
      projects: [{ projectId }],
    },
  ],
  decisions: [
    {
      id: decisionId,
      title: "是否继续投入人生档案馆",
      description: "看它是否能持续帮助回顾与规划",
      finalDecision: null,
      status: "active",
      createdAt: new Date("2026-07-14T10:00:00.000Z"),
      evidenceItems: [
        {
          sourceCitation: projectCitation,
        },
      ],
    },
  ],
};

const graph = buildLifeGraphSubgraph(records, {});
assert.equal(graph.nodes.length, 6, "should return all six owned graph nodes");
assert.equal(graph.edges.length, 5, "should derive five explicit relationships");
assert.deepEqual(
  new Set(graph.edges.map((edge) => edge.relationType)),
  new Set([
    "formed_memory",
    "demonstrates_ability",
    "project_uses_ability",
    "influenced_decision",
    "ability_parent",
  ]),
  "should only return supported explicit relationship types",
);

const eventNodeId = `event:${eventId}`;
const eventNode = graph.nodes.find((node) => node.id === eventNodeId);
assert.equal(eventNode.source.sourceType, "evidence_fragment");
assert.equal(eventNode.source.excerpt, "人生星图原始记录片段");
const localGraph = buildLifeGraphSubgraph(records, { centerId: eventNodeId, depth: 1 });
assert.deepEqual(
  new Set(localGraph.nodes.map((node) => node.id)),
  new Set([eventNodeId, `memory:${memoryId}`, `ability:${abilityChildId}`]),
  "depth one should return the center and its direct neighbors",
);

const withoutCandidates = buildLifeGraphSubgraph(records, { statuses: ["recorded", "confirmed", "active"] });
assert.ok(
  withoutCandidates.edges.every((edge) => edge.relationType !== "demonstrates_ability"),
  "filtering out candidate nodes should also remove broken candidate edges",
);

assert.equal(graph.availableRange.from, "2026-06-01T00:00:00.000Z");
assert.equal(graph.availableRange.to, "2026-07-14T10:00:00.000Z");
assert.equal(graph.summary.countsByType.ability, 2);

console.log("PASS Life graph builder verification completed");

function citation(id, sourceType, sourceId) {
  return {
    id,
    sourceType,
    sourceId,
    title: "验证来源",
    url: null,
    excerpt: "验证引用片段",
    locator: null,
    metadata: null,
    createdAt: new Date("2026-07-14T08:00:00.000Z"),
  };
}
