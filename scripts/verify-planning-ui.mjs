#!/usr/bin/env node
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";

assertIsolatedVerificationRuntime();
const webBaseUrl = process.env.WEB_BASE_URL;
const stamp = Date.now();
const goalTitle = `浏览器人生目标 ${stamp}`;
const planTitle = `浏览器推进计划 ${stamp}`;
const milestoneTitle = `浏览器里程碑 ${stamp}`;
const actionTitle = `浏览器行动 ${stamp}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
try {
  await page.goto(`${webBaseUrl}/planning`, { waitUntil: "networkidle" });
  await page.getByLabel("目标名称").fill(goalTitle);
  await page.getByLabel("人生领域").fill("个人成长");
  await page.getByLabel("希望完成日期").fill("2032-12-31");
  await page.getByLabel("怎样算达成").fill("可以连续回看十年记录");
  await page.getByRole("button", { name: "加入指南针" }).click();
  await page.getByText("目标已加入指南针和人生星图").waitFor();
  const goalCard = page.getByRole("article").filter({ hasText: goalTitle });
  await goalCard.getByLabel("给这个目标添加计划名称").fill(planTitle);
  await goalCard.getByRole("button", { name: "添加" }).click();
  await page.getByText("计划已加入目标").waitFor();
  const planBlock = goalCard.locator("div.border.border-border.bg-background").filter({ hasText: planTitle });
  await planBlock.getByLabel("新增里程碑名称").fill(milestoneTitle);
  await planBlock.getByRole("button", { name: "添加" }).first().click();
  await page.getByText("里程碑已加入计划").waitFor();
  await planBlock.getByLabel("新增行动名称").fill(actionTitle);
  await planBlock.getByRole("button", { name: "添加" }).last().click();
  await page.getByText("行动项已加入计划").waitFor();
  await planBlock.getByLabel(`完成行动“${actionTitle}”`).click();
  await page.getByText("行动状态已更新").waitFor();
  assert.equal(await planBlock.getByLabel(`完成行动“${actionTitle}”`).isChecked(), true);

  await page.goto(`${webBaseUrl}/life-graph`, { waitUntil: "networkidle" });
  await page.getByLabel("搜索人生星图节点").fill(goalTitle);
  await page.getByRole("button", { name: new RegExp(goalTitle) }).click();
  await page.getByRole("button", { name: `拆成计划 ${planTitle}` }).waitFor();
  console.log("PASS Future planning page to 3D graph browser verification completed");
} finally { await browser.close(); }
