#!/usr/bin/env node
import assert from "node:assert/strict";
import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";

assertIsolatedVerificationRuntime();
const baseUrl = process.env.API_BASE_URL;
const stamp = Date.now();
const goal = await request("/api/planning/goals", { method: "POST", body: { title: `十年档案目标 ${stamp}`, area: "个人成长", successCriteria: "每月可回看", targetDate: "2030-12-31T00:00:00.000Z", priority: 1 } });
await request(`/api/planning/goals/${goal.id}/plans`, { method: "POST", expectedStatus: 400, body: { title: "错误日期计划", startDate: "2030-01-02T00:00:00.000Z", endDate: "2030-01-01T00:00:00.000Z" } });
const plan = await request(`/api/planning/goals/${goal.id}/plans`, { method: "POST", body: { title: `年度建设计划 ${stamp}`, startDate: "2029-01-01T00:00:00.000Z", endDate: "2029-12-31T00:00:00.000Z" } });
const milestone = await request(`/api/planning/plans/${plan.id}/milestones`, { method: "POST", body: { title: `完成可用版本 ${stamp}`, dueAt: "2029-06-30T00:00:00.000Z" } });
const action = await request(`/api/planning/plans/${plan.id}/actions`, { method: "POST", body: { title: `整理第一批档案 ${stamp}`, milestoneId: milestone.id, dueAt: "2029-02-01T00:00:00.000Z" } });

const tree = await request("/api/planning/tree");
const storedGoal = tree.find((item) => item.id === goal.id);
assert.equal(storedGoal.plans[0].milestones[0].id, milestone.id);
assert.equal(storedGoal.plans[0].actionItems[0].id, action.id);

const graph = await request("/api/life-graph/subgraph?limit=400");
for (const id of [`goal:${goal.id}`, `plan:${plan.id}`, `milestone:${milestone.id}`, `action:${action.id}`]) assert.ok(graph.nodes.some((node) => node.id === id), id);
assert.ok(graph.edges.some((edge) => edge.relationType === "goal_has_plan" && edge.source === `goal:${goal.id}`));
assert.ok(graph.edges.some((edge) => edge.relationType === "plan_has_milestone" && edge.target === `milestone:${milestone.id}`));
assert.ok(graph.edges.some((edge) => edge.relationType === "milestone_has_action" && edge.target === `action:${action.id}`));

const done = await request(`/api/planning/actions/${action.id}`, { method: "PATCH", body: { status: "done" } });
assert.equal(done.status, "done");
assert.ok(done.completedAt);
const archive = await request("/api/data-control/archive-export");
assert.ok(archive.collections.goals.some((item) => item.id === goal.id));
assert.ok(archive.collections.actionItems.some((item) => item.id === action.id));

await request(`/api/planning/goals/${goal.id}`, { method: "DELETE", expectedStatus: 204 });
assert.equal((await request("/api/planning/tree")).some((item) => item.id === goal.id), false);
console.log("PASS Future planning hierarchy, archive and 3D graph verification completed");

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, { method: options.method ?? "GET", headers: options.method === "DELETE" ? undefined : { "content-type": "application/json" }, body: options.body ? JSON.stringify(options.body) : undefined });
  if (options.expectedStatus) { assert.equal(response.status, options.expectedStatus); return options.expectedStatus === 204 ? null : response.json(); }
  const payload = await response.json(); assert.equal(response.ok, true, JSON.stringify(payload)); return payload.data;
}
