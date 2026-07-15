#!/usr/bin/env node

import assert from "node:assert/strict";
import { chromium } from "playwright";

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";

assertIsolatedVerificationRuntime();
const webBaseUrl = process.env.WEB_BASE_URL;
const apiBaseUrl = process.env.API_BASE_URL;
if (!webBaseUrl || !apiBaseUrl) throw new Error("WEB_BASE_URL and API_BASE_URL are required.");
const stamp = `assistant-ui-${Date.now()}`;

await api("/api/ai/settings", { method: "PUT", body: { baseUrl: "https://models.example.test/v1", fastModel: "fake-fast", analysisModel: "fake-analysis", enabled: true, externalProcessingConsent: true } });
await api("/api/memories", { method: "POST", body: { memoryType: "event", content: `${stamp} 浏览器引用来源`, status: "confirmed" } });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const consoleErrors = [];
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("pageerror", (error) => consoleErrors.push(error.message));
try {
  await page.goto(`${webBaseUrl}/assistant`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "档案助手" }).waitFor();
  await page.getByLabel("向档案助手提问").fill(`${stamp} 浏览器引用来源`);
  await page.getByRole("button", { name: "发送问题" }).click();
  await page.getByText("AI 生成").waitFor();
  await page.getByText("fake-analysis").first().waitFor();
  await page.getByRole("complementary", { name: "本次回答来源" }).getByText("S1").first().waitFor();
  await page.getByText("档案内容：检索到的记录提供了与问题相关的线索").waitFor();
  await page.getByRole("link", { name: /S1/ }).first().click();
  await page.waitForURL(/\/(archive|timeline|projects|ability-tree|planning|weekly-review|people)/);

  await page.goto(`${webBaseUrl}/settings/ai`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "档案助手设置" }).waitFor();
  await page.getByText("不会发送完整数据库或完整文件").waitFor();
  await page.getByRole("button", { name: "测试快速模型" }).click();
  await page.getByText(/快速模型连接成功：fake-fast/).waitFor();
  await page.getByRole("button", { name: "测试分析模型" }).click();
  await page.getByText(/分析模型连接成功：fake-analysis/).waitFor();
  assert.deepEqual(consoleErrors, []);
  console.log("PASS Assistant page, streaming state, citation navigation, settings and console verification completed");
} finally {
  await browser.close();
}

async function api(pathname, options = {}) {
  const response = await fetch(`${apiBaseUrl}${pathname}`, { method: options.method ?? "GET", headers: { "content-type": "application/json" }, body: options.body ? JSON.stringify(options.body) : undefined });
  const payload = await response.json();
  assert.equal(response.ok, true, JSON.stringify(payload));
  return payload.data;
}
