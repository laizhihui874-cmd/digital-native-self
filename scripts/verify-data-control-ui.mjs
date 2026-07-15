#!/usr/bin/env node

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";
assertIsolatedVerificationRuntime();

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const webBaseUrl = process.env.WEB_BASE_URL;
const apiBaseUrl = process.env.API_BASE_URL;
if (!webBaseUrl || !apiBaseUrl) throw new Error("WEB_BASE_URL and API_BASE_URL are required.");
const apiRequire = createRequire(new URL("../apps/api/package.json", import.meta.url));
const JSZip = apiRequire("jszip");

const stamp = Date.now();
const response = await fetch(`${apiBaseUrl}/api/evidence/artifacts/text`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ title: `浏览器导出 ${stamp}`, content: `浏览器导出验收资料 ${stamp}` }),
});
assert.equal(response.ok, true, await response.text());

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
try {
  await page.goto(`${webBaseUrl}/data-control`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "数据与隐私" }).waitFor();
  await page.getByText("历史文件解析").waitFor();
  await page.getByText("仅本机", { exact: true }).first().waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出完整档案包" }).click();
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  assert.ok(downloadedPath);
  const zip = await JSZip.loadAsync(await readFile(downloadedPath));
  const archive = JSON.parse(await zip.file("archive.json").async("string"));
  assert.equal(archive.schemaVersion, "digital-self-archive/v1");
  assert.ok(archive.collections.evidenceArtifacts.some((item) => item.title === `浏览器导出 ${stamp}`));
  await page.getByText("完整档案包已生成").waitFor();
  await page.getByLabel("选择要检查的档案包").setInputFiles(downloadedPath);
  await page.getByText("档案包已完成只读检查").waitFor();
  await page.getByLabel("档案恢复预览结果").getByText("digital-self-archive/v1").waitFor();
  await page.getByLabel("档案恢复预览结果").getByText("ID 冲突").waitFor();
  await page.getByRole("button", { name: "合并并跳过冲突" }).click();
  await page.getByLabel("档案恢复结果").waitFor();
  await page.getByText(/恢复完成：导入 \d+ 条，跳过 \d+ 条/).waitFor();
  console.log("PASS Data control export, restore preview and merge-skip browser verification completed");
} finally {
  await browser.close();
}
