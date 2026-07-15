#!/usr/bin/env node

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";
assertIsolatedVerificationRuntime();

import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const webBaseUrl = process.env.WEB_BASE_URL;
const apiBaseUrl = process.env.API_BASE_URL;
if (!webBaseUrl || !apiBaseUrl) throw new Error("WEB_BASE_URL and API_BASE_URL are required.");
const stamp = Date.now();
const firstTitle = `星图人工关系起点 ${stamp}`;
const secondTitle = `星图人工关系终点 ${stamp}`;
await createConfirmedEvent(firstTitle, "2020-05-01T12:00:00.000Z");
await createConfirmedEvent(secondTitle, "2021-06-01T12:00:00.000Z");
const evidenceDirectory = path.resolve("output/playwright/graph-relations");
await mkdir(evidenceDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
page.setDefaultTimeout(20_000);
try {
  await page.goto(`${webBaseUrl}/life-graph`, { waitUntil: "networkidle" });
  await page.getByLabel("搜索人生星图节点").fill(firstTitle);
  await page.getByRole("button", { name: new RegExp(firstTitle) }).click();
  await page.getByLabel("连接到").selectOption({ label: `事件 · ${secondTitle}` });
  await page.getByLabel("关系名称").fill("促成了后续反思");
  const relationForm = page.locator("form").filter({ hasText: "建立人工关系" });
  await relationForm.getByLabel("生效日期").fill("2022-01-01");
  await relationForm.getByLabel("结束日期").fill("2024-01-01");
  await page.getByRole("button", { name: "加入关系" }).click();
  await page.getByText("关系已加入星图").waitFor();
  await page.getByText("促成了后续反思").waitFor();

  const detailPanel = page.locator("aside");
  const pastResponse = page.waitForResponse((item) => item.url().includes("/api/life-graph/subgraph") && item.url().includes("asOf=2021-12-31"));
  await page.getByLabel("回看到日期").fill("2021-12-31");
  await pastResponse;
  await page.waitForTimeout(200);
  await detailPanel.getByText("0 条", { exact: true }).waitFor();
  const activeResponse = page.waitForResponse((item) => item.url().includes("/api/life-graph/subgraph") && item.url().includes("asOf=2023-06-01"));
  await page.getByLabel("回看到日期").fill("2023-06-01");
  await activeResponse;
  await detailPanel.getByText("促成了后续反思", { exact: true }).waitFor();
  await page.screenshot({ path: path.join(evidenceDirectory, "manual-relation-as-of.png"), fullPage: true });
  console.log("PASS Life graph manual relation and as-of browser verification completed");
} finally {
  await browser.close();
}

async function createConfirmedEvent(title, occurredAt) {
  const artifact = await request("/api/evidence/artifacts/text", { method: "POST", body: { title, content: `${title} 的浏览器验收来源` } });
  const candidate = await request("/api/event-candidates", { method: "POST", body: {
    evidenceFragmentId: artifact.revisions[0].fragments[0].id, title, eventType: "other", occurredAt, timePrecision: "day",
  } });
  return request(`/api/event-candidates/${candidate.id}/review`, { method: "PATCH", body: { status: "confirmed" } });
}

async function request(pathname, options) {
  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    method: options.method, headers: { "content-type": "application/json" }, body: JSON.stringify(options.body),
  });
  const payload = await response.json();
  assert.equal(response.ok, true, JSON.stringify(payload));
  return payload.data;
}
