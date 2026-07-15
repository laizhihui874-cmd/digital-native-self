#!/usr/bin/env node
import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";
assertIsolatedVerificationRuntime();
import { chromium } from "playwright";
const webBaseUrl = process.env.WEB_BASE_URL;
if (!webBaseUrl) throw new Error("WEB_BASE_URL is required.");
const stamp = Date.now();
const name = `浏览器人物 ${stamp}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
try {
  await page.goto(`${webBaseUrl}/people`, { waitUntil: "networkidle" });
  await page.getByLabel("姓名或称呼").fill(name);
  await page.getByLabel("与你的关系").fill("共同创作者");
  await page.getByLabel("初次相识日期").fill("2019-03-01");
  await page.getByLabel("说明").fill("一起完成长期项目。 ");
  await page.getByRole("button", { name: "加入人物档案" }).click();
  await page.getByText("人物已加入人生档案和星图").waitFor();
  await page.goto(`${webBaseUrl}/life-graph`, { waitUntil: "networkidle" });
  await page.getByLabel("搜索人生星图节点").fill(name);
  await page.getByRole("button", { name: new RegExp(name) }).waitFor();
  console.log("PASS People page to 3D life graph browser verification completed");
} finally { await browser.close(); }
