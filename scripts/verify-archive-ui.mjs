#!/usr/bin/env node

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";
assertIsolatedVerificationRuntime();

import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const webBaseUrl = process.env.WEB_BASE_URL;
if (!webBaseUrl) throw new Error("WEB_BASE_URL is required.");

const stamp = Date.now();
const artifactTitle = `浏览器档案 ${stamp}`;
const eventTitle = `浏览器确认事件 ${stamp}`;
const memoryContent = `浏览器验证让我确认：档案结论需要保留原始来源。${stamp}`;
const sourceText = `2026-07-14 通过浏览器完成原始资料到人生时间线的追溯验证。${stamp}`;
const evidenceDirectory = path.resolve("output/playwright/archive-flow");
await mkdir(evidenceDirectory, { recursive: true });

const browser = await chromium.launch({ headless: process.env.ARCHIVE_UI_HEADLESS !== "false" });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(20_000);

try {
  await page.goto(`${webBaseUrl}/archive`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "待整理档案" }).waitFor();
  const uploadedSourceText = `浏览器上传的历史文件原文。${stamp}`;
  await page.getByLabel("上传历史文件").setInputFiles({
    name: `browser-archive-${stamp}.txt`,
    mimeType: "text/plain",
    buffer: Buffer.from(uploadedSourceText, "utf8"),
  });
  await page.getByRole("button", { name: "上传并保留原件" }).click();
  await page.getByText("文件原始字节和解析文本已分开保存").waitFor();
  await page.getByText(uploadedSourceText, { exact: false }).waitFor();

  await page.getByLabel("资料标题").fill(artifactTitle);
  await page.getByLabel("原始内容").fill(sourceText);
  await page.getByRole("button", { name: "保存原始资料" }).click();
  await page.getByText("原始资料已保存").waitFor();

  await page.getByLabel("事件标题").fill(eventTitle);
  await page.getByLabel("发生时间").fill("2026-07-14T17:30");
  await page.getByLabel("事件类型").selectOption("project");
  await page.getByLabel("补充说明").fill("这是用户在浏览器中手动确认的事件。");
  await page.getByRole("button", { name: "加入待确认" }).click();
  const candidateCard = page.locator("article").filter({ hasText: eventTitle }).first();
  await candidateCard.waitFor();
  await candidateCard.getByRole("button", { name: "确认进入时间线" }).click();
  await page.getByText("事件已确认，并进入正式时间线").waitFor();
  await page.screenshot({ path: path.join(evidenceDirectory, "archive-confirmed.png"), fullPage: true });

  await page.goto(`${webBaseUrl}/timeline`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "人生时间线" }).waitFor();
  const eventCard = page.locator("article").filter({ hasText: eventTitle }).first();
  await eventCard.waitFor();
  await eventCard.getByText(sourceText, { exact: false }).waitFor();
  await eventCard.getByText("1 个版本", { exact: false }).waitFor();
  await page.screenshot({ path: path.join(evidenceDirectory, "timeline-provenance.png"), fullPage: true });

  await eventCard.getByLabel("候选长期记忆").fill(memoryContent);
  await eventCard.getByRole("button", { name: "加入候选记忆" }).click();
  await page.getByText("候选长期记忆已生成").waitFor();

  await page.goto(`${webBaseUrl}/memories/review`, { waitUntil: "networkidle" });
  const memoryCard = page.locator("article").filter({ hasText: memoryContent }).first();
  await memoryCard.waitFor();
  await memoryCard.getByRole("button", { name: "确认" }).click();
  await page.getByText("已确认候选记忆").waitFor();

  await page.goto(`${webBaseUrl}/life-graph`, { waitUntil: "networkidle" });
  await page.getByLabel("搜索人生星图节点").fill(memoryContent);
  await page.locator("button").filter({ hasText: memoryContent }).first().waitFor();
  await page.screenshot({ path: path.join(evidenceDirectory, "life-graph-confirmed-memory.png"), fullPage: true });

  console.log("PASS Archive UI manual evidence -> candidate -> confirmed timeline flow completed");
} finally {
  await context.close();
  await browser.close();
}
