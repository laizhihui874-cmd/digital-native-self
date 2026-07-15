#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const inputPath = path.resolve(process.env.ARCHIVE_EVALUATION_SET ?? "storage/evaluations/ai-archive-questions.json");
const outputDirectory = path.resolve(process.env.ARCHIVE_EVALUATION_OUTPUT ?? "storage/evaluations/runs");
const baseUrl = (process.env.API_BASE_URL ?? "http://127.0.0.1:3211").replace(/\/$/, "");
const dataset = JSON.parse(await readFile(inputPath, "utf8"));
if (!Array.isArray(dataset.questions) || dataset.questions.length < 50) throw new Error("评测问题集至少需要 50 个问题。");

const results = [];
for (const item of dataset.questions) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/api/archive-search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: item.question, limit: 12, allowExpansion: process.env.EVALUATION_ALLOW_EXPANSION === "1" }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? `问题 ${item.id} 检索失败。`);
  const expected = Array.isArray(item.expectedSourceIds) ? item.expectedSourceIds : [];
  const topTenIds = payload.data.hits.slice(0, 10).map((hit) => hit.sourceId);
  results.push({
    id: item.id,
    question: item.question,
    searchMode: payload.data.searchMode,
    expandedTerms: payload.data.expandedTerms,
    durationMs: Math.round(performance.now() - startedAt),
    hitCount: payload.data.hits.length,
    topTen: payload.data.hits.slice(0, 10).map((hit) => ({ sourceType: hit.sourceType, sourceId: hit.sourceId, title: hit.title })),
    expectedSourceInTopTen: expected.length ? expected.some((id) => topTenIds.includes(id)) : null,
    helpful: null,
    citationSupported: null,
  });
}

const report = {
  datasetVersion: dataset.version,
  createdAt: new Date().toISOString(),
  allowExpansion: process.env.EVALUATION_ALLOW_EXPANSION === "1",
  questionCount: results.length,
  averageSearchMs: Math.round(results.reduce((sum, item) => sum + item.durationMs, 0) / results.length),
  zeroResultCount: results.filter((item) => item.hitCount === 0).length,
  expansionCount: results.filter((item) => item.searchMode === "lexical_expanded").length,
  results,
};
await mkdir(outputDirectory, { recursive: true });
const outputPath = path.join(outputDirectory, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
await writeFile(outputPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ outputPath, questionCount: report.questionCount, averageSearchMs: report.averageSearchMs, zeroResultCount: report.zeroResultCount, expansionCount: report.expansionCount }, null, 2));
