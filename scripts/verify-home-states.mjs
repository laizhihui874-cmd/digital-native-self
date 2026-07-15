#!/usr/bin/env node

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";
assertIsolatedVerificationRuntime();

import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright";

const webBaseUrl = normalizeBaseUrl(process.env.WEB_BASE_URL);
const apiBaseUrl = normalizeBaseUrl(process.env.API_BASE_URL);
const evidenceDirectory = path.resolve("output/playwright/home-states");

assert(webBaseUrl, "WEB_BASE_URL is required.");
assert(apiBaseUrl, "API_BASE_URL is required.");

await mkdir(evidenceDirectory, { recursive: true });

const browser = await chromium.launch({ headless: process.env.HOME_STATES_HEADLESS !== "false" });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(20_000);

try {
  await page.goto(webBaseUrl, { waitUntil: "networkidle" });
  await expectText(page, "人生档案馆");
  await expectText(page, "还没有正在推进的人生决策");
  await expectText(page, "还没有候选路径");
  await expectText(page, "还没有可以计算指标的每日记录");
  await expectText(page, "待确认记忆");
  await expectText(page, "活跃项目");
  await expectAbsent(page, "14 天倒计时");
  await expectAbsent(page, "继续当前工作");
  await page.screenshot({ path: path.join(evidenceDirectory, "home-empty.png"), fullPage: true });

  await page.route(`${apiBaseUrl}/api/**`, (route) => route.abort("failed"));
  await page.reload({ waitUntil: "networkidle" });
  await expectText(page, "当前无法读取个人档案");
  await expectText(page, "页面不会用样例内容代替你的数据");
  await expectText(page, "重新读取");
  await expectAbsent(page, "继续当前工作");
  await page.screenshot({ path: path.join(evidenceDirectory, "home-api-error.png"), fullPage: true });

  console.log("[verify:home-states] PASS empty and API-error states use no sample content");
} finally {
  await context.close();
  await browser.close();
}

async function expectText(activePage, text) {
  await activePage.getByText(text, { exact: false }).first().waitFor({ state: "visible" });
}

async function expectAbsent(activePage, text) {
  assert.equal(await activePage.getByText(text, { exact: false }).count(), 0, `Unexpected text: ${text}`);
}

function normalizeBaseUrl(value) {
  return value?.trim().replace(/\/$/, "") ?? "";
}
