#!/usr/bin/env node

import assert from "node:assert/strict";
import { chromium } from "playwright";

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";

assertIsolatedVerificationRuntime();
const webBaseUrl = process.env.WEB_BASE_URL;
const apiBaseUrl = process.env.API_BASE_URL;
if (!webBaseUrl || !apiBaseUrl) throw new Error("WEB_BASE_URL and API_BASE_URL are required.");
const stamp = `review-inbox-ui-${Date.now()}`;

const artifact = await api("/api/evidence/artifacts/text", { method: "POST", body: { title: `${stamp} 来源`, content: `${stamp} 原始内容` } });
const proposal = await api("/api/event-candidates", { method: "POST", body: { evidenceFragmentId: artifact.revisions[0].fragments[0].id, title: `${stamp} 事件建议`, description: `${stamp} 事件正文`, eventType: "project", occurredAt: "2026-07-15T08:00:00.000Z", timePrecision: "day" } });
const memory = await api("/api/memories", { method: "POST", body: { memoryType: "value", content: `${stamp} 候选记忆`, status: "candidate" } });
const node = await api("/api/ability-nodes", { method: "POST", body: { name: `${stamp} 能力` } });
const ability = await api("/api/ability-evidence", { method: "POST", body: { abilityNodeId: node.id, content: `${stamp} 候选能力证据`, impact: "positive", difficultyScore: 3, independenceScore: 4, impactScore: 4, feedbackScore: 1 } });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("pageerror", (error) => consoleErrors.push(error.message));

try {
  await page.goto(`${webBaseUrl}/ai-inbox`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "统一待确认" }).waitFor();
  await page.getByText("AI 产生的新建议不会直接修改正式档案").waitFor();

  const proposalCard = page.locator(`input[value="${stamp} 事件建议"]`).locator("xpath=ancestor::article");
  const memoryCard = page.locator("textarea").filter({ hasText: `${stamp} 候选记忆` }).locator("xpath=ancestor::article");
  await proposalCard.getByRole("link", { name: `${stamp} 来源` }).waitFor();
  await proposalCard.getByRole("checkbox").check();
  await memoryCard.getByRole("checkbox").check();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "批量确认预览" }).click();
  await page.getByText("批量处理完成：成功 2 条，失败 0 条").waitFor();
  assert.equal((await api(`/api/event-candidates/${proposal.id}`)).status, "confirmed");
  assert.equal((await api(`/api/memories/${memory.id}`)).status, "confirmed");

  await page.getByLabel(`选择 能力证据 · ${stamp} 能力`).check();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "批量拒绝" }).click();
  await page.getByText("批量处理完成：成功 1 条，失败 0 条").waitFor();
  assert.equal((await api(`/api/ability-evidence/${ability.id}`)).status, "rejected");

  await page.getByRole("button", { name: "已确认", exact: true }).click();
  const confirmedProposal = page.locator(`input[value="${stamp} 事件建议"]`).locator("xpath=ancestor::article");
  await confirmedProposal.getByRole("button", { name: "撤销并恢复待确认" }).click();
  await confirmedProposal.waitFor({ state: "detached" });
  assert.equal((await api(`/api/event-candidates/${proposal.id}`)).status, "candidate");

  await page.getByRole("button", { name: "待确认", exact: true }).click();
  await page.getByLabel("搜索待确认内容").fill(`${stamp} 来源`);
  await page.locator(`input[value="${stamp} 事件建议"]`).waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "统一待确认" }).waitFor();
  assert.deepEqual(consoleErrors, []);
  console.log("PASS Unified review inbox filters, bulk confirm/reject, summary, undo, desktop and mobile verification completed");
} finally {
  await browser.close();
}

async function api(pathname, options = {}) {
  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    method: options.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  assert.equal(response.ok, true, JSON.stringify(payload));
  return payload.data;
}
