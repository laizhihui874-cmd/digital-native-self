#!/usr/bin/env node
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";

assertIsolatedVerificationRuntime();
const baseUrl = process.env.API_BASE_URL;
const webBaseUrl = process.env.WEB_BASE_URL;
const stamp = Date.now();
const personName = `时间线人物 ${stamp}`;
const eventTitle = `时间线共同事件 ${stamp}`;

const person = await request("/api/people", { method: "POST", body: { name: personName } });
const artifact = await request("/api/evidence/artifacts/text", {
  method: "POST",
  body: { title: "时间线人物验收", content: "我们共同完成了一次重要协作。" },
});
const candidate = await request("/api/event-candidates", {
  method: "POST",
  body: {
    evidenceFragmentId: artifact.revisions[0].fragments[0].id,
    title: eventTitle,
    eventType: "project",
    occurredAt: "2023-08-01T00:00:00.000Z",
    timePrecision: "day",
  },
});
await request(`/api/event-candidates/${candidate.id}/review`, {
  method: "PATCH",
  body: { status: "confirmed" },
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
try {
  await page.goto(`${webBaseUrl}/timeline`, { waitUntil: "networkidle" });
  const eventCard = page.getByRole("article").filter({ hasText: eventTitle });
  await eventCard.getByLabel(`为事件“${eventTitle}”选择参与人物`).selectOption(person.id);
  await eventCard.getByLabel(`人物在事件“${eventTitle}”中的角色`).fill("共同见证人");
  await eventCard.getByRole("button", { name: "关联人物" }).click();
  await page.getByText("人物与事件已经连到人生星图").waitFor();
  await page.getByText(`${personName} · 共同见证人`).waitFor();

  await page.goto(`${webBaseUrl}/life-graph`, { waitUntil: "networkidle" });
  await page.getByLabel("搜索人生星图节点").fill(personName);
  await page.getByRole("button", { name: new RegExp(personName) }).click();
  await page.getByText("共同见证人").waitFor();
  await page.getByRole("button", { name: `共同见证人 ${eventTitle}` }).waitFor();
  console.log("PASS Timeline participant to 3D life graph browser verification completed");
} finally {
  await browser.close();
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  assert.equal(response.ok, true, JSON.stringify(payload));
  return payload.data;
}
