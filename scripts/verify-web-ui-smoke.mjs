#!/usr/bin/env node

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";
assertIsolatedVerificationRuntime();

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

import { chromium } from "playwright";

const DEFAULT_WEB_BASE_URL = "http://localhost:3000";
const DEFAULT_API_BASE_URL = "http://localhost:3001";
const DEFAULT_API_HEALTH_PATH = "/api/health";
const REQUEST_TIMEOUT_MS = 15_000;
const UI_TIMEOUT_MS = 20_000;

const webBaseUrl = normalizeBaseUrl(
  process.env.WEB_UI_SMOKE_WEB_BASE_URL ?? process.env.WEB_BASE_URL ?? DEFAULT_WEB_BASE_URL,
);
const apiBaseUrl = normalizeBaseUrl(
  process.env.WEB_UI_SMOKE_API_BASE_URL ?? process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL,
);
const headless = process.env.WEB_UI_SMOKE_HEADLESS !== "false";
const runStartedAt = new Date();
const timestamp = formatTimestamp(runStartedAt);
const runTag = `web-ui-smoke-${timestamp}`;
const evidenceDir = path.resolve(
  `specs/digital-self-mvp/test-evidence/web-ui-smoke-${timestamp}`,
);

const logs = [];
const consoleEvents = [];
const pageErrors = [];
const pageResults = [];

let browser = null;
let context = null;
let page = null;

try {
  await mkdir(evidenceDir, { recursive: true });

  logStep(`Using Web base URL: ${webBaseUrl}`);
  logStep(`Using API base URL: ${apiBaseUrl}`);
  logStep(`Evidence directory: ${evidenceDir}`);
  logStep(`Run tag: ${runTag}`);

  await ensureApiHealthy();
  await ensureWebReachable();

  const seed = await seedUiSmokeData();

  browser = await chromium.launch({ headless });
  context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
  });
  page = await context.newPage();
  page.setDefaultTimeout(UI_TIMEOUT_MS);

  page.on("console", (event) => {
    const line = `[browser:${event.type()}] ${event.text()}`;
    consoleEvents.push(line);
  });
  page.on("pageerror", (error) => {
    const line = `[pageerror] ${formatError(error)}`;
    pageErrors.push(line);
  });

  await verifyHomePage(page, seed);
  await verifyDailyEntryPage(page, seed);
  await verifyMemoriesPage(page, seed);
  await verifyAbilityTreePage(page, seed);
  await verifyWeeklyReviewPage(page);
  await verifyExternalSourcesPage(page, seed);
  await verifyProjectsPage(page, seed);

  await writeArtifacts({
    status: "passed",
    seed,
  });

  logPass("Web UI smoke verification completed");
} catch (error) {
  if (page) {
    await saveScreenshot(page, "zz-failure.png").catch(() => undefined);
  }

  await writeArtifacts({
    status: "failed",
    error: formatError(error),
  }).catch(() => undefined);

  logFail(formatError(error));
  process.exitCode = 1;
} finally {
  if (context) {
    await context.close().catch(() => undefined);
  }

  if (browser) {
    await browser.close().catch(() => undefined);
  }
}

async function verifyHomePage(activePage, seed) {
  await runPageStep("home", async () => {
    await gotoPath(activePage, "/");
    await expectHeading(activePage, "人生档案馆");
    await expectText(activePage, seed.decision.title);
    await expectText(activePage, "最近一次记录的四项指标");
    await expectText(activePage, "继续当前工作");
    await expectText(activePage, "边工作边准备");
    await expectText(activePage, "待确认记忆");
    await assertNoFatalPageState(activePage);
    await saveScreenshot(activePage, "01-home.png");
  });
}

async function verifyDailyEntryPage(activePage, seed) {
  await runPageStep("daily-entry-today", async () => {
    await gotoPath(activePage, "/daily-entry/today");
    await expectHeading(activePage, "今日每日记录");

    const recentEntryButton = activePage.locator("button").filter({
      hasText: seed.visibleEntry.rawContent,
    }).first();
    await recentEntryButton.click();

    await expectText(activePage, seed.visibleEntry.rawContent);
    await expectText(activePage, "结构化日报 / 待确认");
    await expectText(activePage, seed.visibleEntry.structuredReport.facts[0].detail);
    await expectText(activePage, "AI 初判只作为候选参考");

    const growthSelect = activePage.locator("#metric-growth");
    await growthSelect.selectOption(String(seed.visibleEntry.metrics.growth));

    await activePage.getByRole("button", { name: "确认并保存" }).first().click();
    await expectText(activePage, "已写入本日确认分数");
    await assertNoFatalPageState(activePage);
    await saveScreenshot(activePage, "02-daily-entry-today.png");
  });
}

async function verifyMemoriesPage(activePage, seed) {
  await runPageStep("memories-review", async () => {
    await gotoPath(activePage, "/memories/review");
    await expectHeading(activePage, "候选长期记忆批量确认");

    const memoryCard = activePage.locator("article").filter({
      hasText: seed.memoryCandidate.content,
    }).first();
    const updatedContent = `${seed.memoryCandidate.content}（smoke 已确认）`;

    await memoryCard.locator(`#memory-content-${seed.memoryCandidate.id}`).fill(updatedContent);
    await memoryCard.getByRole("button", { name: "确认" }).click();

    await expectText(activePage, "已确认候选记忆");
    await expectTextToDisappear(activePage, seed.memoryCandidate.content);
    await assertNoFatalPageState(activePage);
    await saveScreenshot(activePage, "03-memories-review.png");
  });
}

async function verifyAbilityTreePage(activePage, seed) {
  await runPageStep("ability-tree", async () => {
    await gotoPath(activePage, "/ability-tree");
    await expectHeading(activePage, "能力节点与证据挂载");

    const nodeButton = activePage.locator("button").filter({
      hasText: seed.abilityNode.name,
    }).first();
    await nodeButton.click();

    await expectText(activePage, seed.abilityNode.name);
    await expectText(activePage, seed.candidateAbilityEvidence.content);

    const evidenceCard = activePage.locator("article").filter({
      hasText: seed.candidateAbilityEvidence.content,
    }).first();
    await evidenceCard.getByRole("button", { name: "确认" }).click();

    await expectText(activePage, "候选证据已确认并正式挂载");
    await assertNoFatalPageState(activePage);
    await saveScreenshot(activePage, "04-ability-tree.png");
  });
}

async function verifyWeeklyReviewPage(activePage) {
  await runPageStep("weekly-review", async () => {
    await gotoPath(activePage, "/weekly-review");
    await expectHeading(activePage, "本周推进、模式与下周建议");
    await expectText(activePage, "deterministic 周复盘");
    await activePage.getByRole("button", { name: "生成 deterministic 周复盘" }).click();
    await expectText(activePage, "已生成 deterministic 周复盘");
    await expectText(activePage, "日记");
    await expectText(activePage, "结构化日报");
    await expectText(activePage, "指标评分");
    await expectText(activePage, "决策证据");
    await expectText(activePage, "本周推进");
    await expectText(activePage, "能力变化");
    await expectText(activePage, "情绪模式");
    await expectText(activePage, "下周建议");
    await expectText(activePage, "人生可能性探索");
    await assertNoFatalPageState(activePage);
    await saveScreenshot(activePage, "05-weekly-review.png");
  });
}

async function verifyExternalSourcesPage(activePage, seed) {
  await runPageStep("external-sources", async () => {
    await gotoPath(activePage, "/external-sources");
    await expectHeading(activePage, "外部信息搜索与来源登记");
    await expectText(activePage, "best-effort web search");
    await expectText(activePage, seed.seededExternalSource.title);
    await expectText(activePage, "路径影响草稿");
    await activePage.getByRole("button", { name: "生成路径影响草稿" }).waitFor();

    await activePage.locator("#external-search-query").fill(`${runTag} AI 应用工程师 岗位要求`);
    await activePage.locator("#external-search-category").selectOption("ai_role");
    await activePage.locator("#external-search-limit").fill("2");
    await activePage.getByRole("button", { name: "搜索并保存来源" }).click();

    await expectText(activePage, "已保存 2 条搜索来源");
    await expectText(activePage, "fake provider");
    await expectText(activePage, "保存 2");

    const pathEvidenceCountBeforeDraft = await getPathEvidenceCount(seed.decision.id);
    assert.equal(
      pathEvidenceCountBeforeDraft,
      0,
      "searching and saving external sources should not create path evidence before draft confirmation",
    );

    await activePage
      .getByLabel(`${seed.seededExternalSource.title} 用于本次影响草稿`)
      .uncheck();
    await expectText(activePage, "已勾选 2");

    await activePage.getByRole("button", { name: "生成路径影响草稿" }).click();
    await expectText(activePage, "不会自动写入 DecisionEvidence");
    await expectText(activePage, "候选草稿（未入档）");
    await expectText(activePage, "正式证据回执（已入档）");
    await expectText(activePage, "待用户确认");
    await saveScreenshot(activePage, "06-external-sources-draft.png");

    const firstDraftCard = activePage.locator("article").filter({
      hasText: "待用户确认",
    }).first();
    const confirmDraftButton = firstDraftCard.getByRole("button", {
      name: /确认写入.*证据/,
    });
    await firstDraftCard.waitFor();
    await confirmDraftButton.waitFor();

    const pathEvidenceCountAfterDraft = await getPathEvidenceCount(seed.decision.id);
    assert.equal(
      pathEvidenceCountAfterDraft,
      0,
      "generating impact draft should not persist path evidence before user confirmation",
    );

    await confirmDraftButton.click();
    await expectText(activePage, "已确认入证据");
    await expectText(activePage, "已确认");
    await expectText(activePage, "正式决策证据");
    await waitForPathEvidenceCount(seed.decision.id, 1);

    const confirmedEvidence = await getSinglePathEvidence(seed.decision.id);
    assert.ok(
      typeof confirmedEvidence.sourceCitationId === "string" &&
        confirmedEvidence.sourceCitationId.length > 0,
      "confirmed evidence should expose sourceCitationId after UI confirmation",
    );
    await expectText(activePage, confirmedEvidence.sourceCitationId);
    await expectText(activePage, "来源追溯");
    logPass(
      `external source confirmation created evidence ${confirmedEvidence.id} with sourceCitationId=${confirmedEvidence.sourceCitationId}`,
    );
    await saveScreenshot(activePage, "07-external-sources-confirmed.png");

    const tempTitle = `${runTag} 临时外部来源`;
    await activePage.locator("#source-title").fill(tempTitle);
    await activePage.locator("#source-site").fill("Smoke Source");
    await activePage.locator("#source-date").fill("2026-06-19");
    await activePage.locator("#source-url").fill("https://example.com/smoke-source");
    await activePage.locator("#source-summary").fill("用于校验新增后列表刷新和删除是否正常。");
    await activePage.locator("#source-relation").fill("仅用于本地 smoke 回归，不代表真实联网搜索。");
    await activePage.getByRole("button", { name: "登记来源" }).click();

    await expectText(activePage, "已登记新的外部来源");

    const tempSourceCard = activePage.locator("article").filter({
      hasText: tempTitle,
    }).first();
    await tempSourceCard.getByRole("button", { name: "删除" }).click();

    await expectText(activePage, `已删除「${tempTitle}」`);
    await tempSourceCard.waitFor({ state: "detached", timeout: UI_TIMEOUT_MS });
    await assertNoFatalPageState(activePage);
  });
}

async function verifyProjectsPage(activePage, seed) {
  await runPageStep("projects", async () => {
    await gotoPath(activePage, "/projects");
    await expectHeading(activePage, "项目经历与能力证据工作台");
    await expectText(activePage, "项目包装建议");
    await expectText(activePage, "候选简历素材");
    await expectText(activePage, seed.resumeMaterialCandidate.content);

    const materialCard = activePage.locator("article").filter({
      hasText: seed.resumeMaterialCandidate.content,
    }).first();
    await materialCard.getByRole("button", { name: "确认并编辑" }).click();

    const confirmedMaterialContent = `${seed.resumeMaterialCandidate.content}（smoke 已确认）`;
    await activePage
      .locator(`#resume-material-content-${seed.resumeMaterialCandidate.id}`)
      .fill(confirmedMaterialContent);
    await activePage.getByRole("button", { name: "确认为正式素材" }).click();
    await expectText(activePage, "已确认候选素材");
    await expectTextToDisappear(activePage, seed.resumeMaterialCandidate.content);

    await expectText(activePage, "目标岗位差距分析");
    await activePage.locator("#resume-gap-target-role").fill("AI 应用工程师");
    await activePage.locator("#resume-gap-target-company").fill("Smoke Target");
    await activePage.locator("#resume-gap-target-jd").fill(
      [
        "1. 负责 AI 应用开发、OpenAI API 接入和 Agent 工具链搭建",
        "2. 具备需求拆解、沟通表达和接口联调能力",
        `3. 熟悉 ${runTag} 稀缺岗位能力`,
      ].join("\n"),
    );
    await activePage.getByRole("button", { name: "生成差距分析" }).click();
    await expectText(activePage, "初步差距分析已生成");
    await expectText(activePage, "规则分析");
    await expectText(activePage, "差距项");

    await expectText(activePage, "Project Packaging");
    await activePage.locator("#project-packaging-target-role").fill("AI 应用工程师");
    await activePage.locator("#project-packaging-target-company").fill("Smoke Target");
    await activePage
      .locator("#project-packaging-project")
      .locator(`option[value="${seed.seededProject.id}"]`)
      .waitFor({ state: "attached", timeout: UI_TIMEOUT_MS });
    await activePage.locator("#project-packaging-project").selectOption(seed.seededProject.id);
    await activePage.locator("#project-packaging-target-jd").fill(
      [
        "1. 负责 AI 应用开发、接口联调、自动化验证",
        "2. 能把项目经历包装成清晰的 STAR 简历表达",
      ].join("\n"),
    );
    await activePage.getByRole("button", { name: "生成项目包装建议" }).click();
    await expectText(activePage, "项目包装建议已生成");
    await expectText(activePage, "规则分析");
    await expectText(activePage, "STAR 草稿");
    await expectText(activePage, "缺口提醒");

    const tempProjectName = `${runTag} 临时项目`;
    await activePage.locator("#project-name").fill(tempProjectName);
    await activePage.locator("#project-role").fill("Smoke Runner");
    await activePage.locator("#project-start-date").fill("2026-06-01");
    await activePage.locator("#project-end-date").fill("2026-06-19");
    await activePage.locator("#project-description").fill("用于回归项目新增、证据关联和删除。");
    await activePage.locator("#project-outcomes").fill("完成本地 UI smoke\n生成页面证据");
    await activePage.locator("#project-resume-summary").fill("本地自动化创建的临时项目条目。");

    const evidenceCheckbox = activePage.locator("label").filter({
      hasText: seed.confirmedAbilityEvidence.content,
    }).first().locator('input[type="checkbox"]');
    await evidenceCheckbox.check();

    await activePage.getByRole("button", { name: "创建项目" }).click();
    await expectText(activePage, "项目已创建");

    const createdTempProject = await findProjectByName(tempProjectName);
    assert.ok(createdTempProject?.id, "temporary project should be queryable through the API after UI creation");
    await apiDeleteOk(`/api/projects/${createdTempProject.id}`);
    await assertNoFatalPageState(activePage);
    await saveScreenshot(activePage, "08-projects.png");
  });
}

async function seedUiSmokeData() {
  logStep("Seeding isolated smoke data through API");

  const decision = await apiJson("/api/life-decisions", {
    method: "POST",
    body: {
      title: `${runTag}：2026-07-02 前关键路径选择`,
      description:
        "本轮 smoke 用于验证关键页面能读取 30 天模拟数据，并安全执行候选确认、来源登记和项目整理。",
      deadline: "2026-07-02T00:00:00.000Z",
      status: "active",
      finalDecision: "未下结论；只验证证据读取和页面交互。",
    },
  });

  const pathConfigs = [
    {
      title: "继续当前工作",
      description: "保留收入与真实样本，继续观察低价值任务是否下降。",
      benefits: ["现金流稳定", "继续获取真实协作样本"],
      risks: ["情绪消耗持续", "窗口期被动压缩"],
      currentScore: 63,
    },
    {
      title: "离职考研",
      description: "集中时间准备考研，换取更清晰的长期方向。",
      benefits: ["时间集中", "方向更纯粹"],
      risks: ["成本较高", "不确定性更大"],
      currentScore: 57,
    },
    {
      title: "换工作",
      description: "尝试切换到更贴近 AI 应用开发的环境。",
      benefits: ["方向可能更匹配", "项目空间更大"],
      risks: ["准备不足", "短期面试压力"],
      currentScore: 66,
    },
    {
      title: "边工作边准备",
      description: "保留收入和弹性，同时推进项目、考研与求职证据。",
      benefits: ["风险更可控", "保留多条路径"],
      risks: ["容易透支", "要求时间管理更稳定"],
      currentScore: 71,
    },
  ];

  const createdPaths = [];
  for (const config of pathConfigs) {
    createdPaths.push(
      await apiJson(`/api/life-decisions/${decision.id}/paths`, {
        method: "POST",
        body: config,
      }),
    );
  }

  const latestRecordedAt = new Date("2026-06-19T10:30:00.000+08:00");
  const latestMetrics = {
    growth: 4,
    emotional_drain: 3,
    long_term_fit: 4,
    communication_pressure: 2,
  };

  const dailyEntries = [];
  for (let dayIndex = 0; dayIndex < 30; dayIndex += 1) {
    const recordedAt = new Date(latestRecordedAt);
    recordedAt.setDate(recordedAt.getDate() - (29 - dayIndex));

    const rawContent =
      dayIndex === 29
        ? `${runTag} 第 30 天：完成 30 天决策模拟归档，梳理工作、换工作、考研和双线准备的证据，确认今天先继续累积项目与岗位信息。`
        : `${runTag} 第 ${dayIndex + 1} 天：补记录、看岗位、整理能力证据，观察情绪消耗和长期匹配是否变化。`;

    const entry = await apiJson("/api/daily-entries", {
      method: "POST",
      body: {
        rawContent,
        recordedAt: recordedAt.toISOString(),
      },
    });

    const metrics =
      dayIndex === 29
        ? latestMetrics
        : {
            growth: 3 + (dayIndex % 2),
            emotional_drain: 2 + (dayIndex % 3),
            long_term_fit: 3 + ((dayIndex + 1) % 2),
            communication_pressure: 2 + (dayIndex % 2),
          };

    for (const [metricType, score] of Object.entries(metrics)) {
      await apiJson(`/api/daily-entries/${entry.id}/metric-ratings`, {
        method: "POST",
        body: {
          metricType,
          aiScore: score,
          userScore: score,
          finalScore: score,
          aiReason: `${runTag} 30 天模拟已确认分数：${metricType}`,
          confirmedByUser: true,
        },
      });
    }

    dailyEntries.push({
      id: entry.id,
      rawContent,
      recordedAt: recordedAt.toISOString(),
      metrics,
    });
  }

  const latestEntry = dailyEntries.at(-1);
  assert(latestEntry, "latest daily entry should exist");

  const latestStructuredReport = {
    facts: [
      { title: "关键事实", detail: `${runTag} 已连续记录 30 天，并把工作、换工作与考研证据放在同一张表里比较。` },
      { detail: "今天补齐了 UI smoke 脚本、证据目录和关键页面回归。"},
    ],
    emotions: [
      { title: "情绪", detail: "对长期方向仍然谨慎，但比纯情绪决策更稳定。" },
    ],
    workItems: [
      { title: "推进", detail: "把每日记录、长期记忆、能力证据、外部来源和项目页串成同一条本地闭环。" },
    ],
    feedback: [
      { title: "反馈", detail: "只有把证据和路径放在一起比较，今天的判断才不容易失真。" },
    ],
    growthEvidence: [
      { title: "成长证据", detail: "能把 30 天输入整理成页面级证据，而不是只堆接口和待办。" },
    ],
    drainSources: [
      { title: "消耗来源", detail: "低价值重复工作仍会抬高情绪消耗，需要继续观察。" },
    ],
    nextActions: [
      { title: "下一步", detail: "继续补岗位样本、确认能力证据，并把真实项目表达写进简历素材。" },
    ],
    decisionImpact: [
      { title: "决策影响", detail: "当前更支持边工作边准备，但仍要继续比较换工作的外部样本。" },
    ],
  };

  await apiJson("/api/structured-daily-reports", {
    method: "POST",
    body: {
      dailyEntryId: latestEntry.id,
      ...latestStructuredReport,
    },
  });

  const visibleEntryMetrics = {
    growth: 4,
    emotional_drain: 3,
    long_term_fit: 4,
    communication_pressure: 2,
  };
  const visibleEntryStructuredReport = {
    facts: [
      {
        title: "可见锚点",
        detail: `${runTag} UI 锚点：这条记录专门用于最近记录列表 smoke，不依赖第 30 天条目刚好出现在第一页。`,
      },
      {
        detail: "这条锚点记录总结了 30 天模拟的关键信息，并确保页面最近记录区有稳定可点条目。",
      },
    ],
    emotions: [
      { title: "情绪", detail: "相比只看单日波动，现在更关注整段时间的证据变化。" },
    ],
    workItems: [
      { title: "推进", detail: "用一条专用锚点记录连接 30 天模拟数据和页面 smoke 验证。" },
    ],
    feedback: [
      { title: "反馈", detail: "最近记录区可能分页或排序变化，所以脚本应点击稳定可见条目。" },
    ],
    growthEvidence: [
      { title: "成长证据", detail: "能根据页面行为修正测试策略，而不是把假设写死在脚本里。" },
    ],
    drainSources: [
      { title: "消耗来源", detail: "如果依赖固定第 30 天条目，列表分页变化就会让 smoke 变脆。" },
    ],
    nextActions: [
      { title: "下一步", detail: "继续验证长期记忆、能力证据、外部来源和项目页的 UI 闭环。" },
    ],
    decisionImpact: [
      { title: "决策影响", detail: "边工作边准备仍然更稳，但测试脚本必须先保证页面读取路径稳定。" },
    ],
  };

  const visibleEntry = await createDailyEntryFixture({
    rawContent: `${runTag} UI 锚点记录：用于 smoke 在最近记录列表中稳定命中可见条目，并回看 30 天模拟汇总结论。`,
    recordedAt: "2099-12-31T15:00:00.000Z",
    metrics: visibleEntryMetrics,
    structuredReport: visibleEntryStructuredReport,
  });

  const memoryCandidate = await apiJson("/api/memories", {
    method: "POST",
    body: {
      memoryType: "decision",
      content: `${runTag} 候选记忆：边工作边准备当前更稳，但前提是每周继续补齐岗位、考研和项目证据。`,
      status: "candidate",
      isMomentaryThought: false,
    },
  });

  const rootAbilityNode = await apiJson("/api/ability-nodes", {
    method: "POST",
    body: {
      name: `${runTag}-专业能力`,
      description: "围绕 AI 应用开发、自动化验证和页面闭环实现的能力节点。",
    },
  });

  const abilityNode = await apiJson("/api/ability-nodes", {
    method: "POST",
    body: {
      name: `${runTag}-自动化验证`,
      description: "把真实 API、UI 页面和证据归档串成可重复执行回归。",
      parentId: rootAbilityNode.id,
    },
  });

  const confirmedAbilityEvidenceCandidate = await apiJson("/api/ability-evidence", {
    method: "POST",
    body: {
      abilityNodeId: abilityNode.id,
      content: `${runTag} 已把本地 API 造数、浏览器 smoke 和证据归档整合成一个脚本入口。`,
      impact: "positive",
      difficultyScore: 4,
      independenceScore: 4,
      impactScore: 4,
      feedbackScore: 1,
      recurrenceCount: 1,
    },
  });

  const confirmedAbilityEvidence = await apiJson(
    `/api/ability-evidence/${confirmedAbilityEvidenceCandidate.id}/review`,
    {
      method: "PATCH",
      body: {
        status: "confirmed",
      },
    },
  );

  const candidateAbilityEvidence = await apiJson("/api/ability-evidence", {
    method: "POST",
    body: {
      abilityNodeId: abilityNode.id,
      content: `${runTag} 候选证据：能在不清理现有数据的前提下，为关键页面补齐可重复运行的 smoke 回归。`,
      impact: "positive",
      difficultyScore: 4,
      independenceScore: 5,
      impactScore: 4,
      feedbackScore: 1,
      recurrenceCount: 1,
    },
  });

  const seededExternalSource = await apiJson("/api/external-sources", {
    method: "POST",
    body: {
      lifeDecisionId: decision.id,
      title: `${runTag} 岗位样本`,
      sourceSite: "Smoke Jobs",
      url: "https://example.com/jobs/smoke",
      publishedAt: "2026-06-18T00:00:00.000Z",
      summary: "用于验证外部来源页能读取已登记样本。",
      relationToDecision: "更支持先继续积累岗位样本，再决定是否立即换工作。",
    },
  });

  const seededProject = await apiJson("/api/projects", {
    method: "POST",
    body: {
      name: `${runTag} 数字原生自我 MVP`,
      description: "30 天模拟与页面级 smoke 证据的本地项目条目。",
      role: "AI 应用开发 / 自动化验证",
      startDate: "2026-06-01T00:00:00.000Z",
      endDate: "2026-06-19T00:00:00.000Z",
      status: "active",
      outcomes: [
        "串起关键页面的浏览器 smoke 回归",
        "把 30 天模拟数据落到页面可见证据",
      ],
      resumeSummary: "把 API 造数、页面校验和证据归档合并为可重复运行的本地自动化脚本。",
      abilityEvidenceIds: [confirmedAbilityEvidence.id],
    },
  });

  const resumeMaterialCandidate = await apiJson("/api/resume-materials", {
    method: "POST",
    body: {
      content: `${runTag} 候选简历素材：把页面级 smoke、API 造数和证据归档整合成一个可复用回归入口。`,
      materialType: "achievement",
      suggestedBullet: "整合页面级 smoke、API 造数与证据归档，形成可复用本地回归入口。",
      status: "candidate",
    },
  });

  logPass("Seed data created for the UI smoke run");

  return {
    decision,
    paths: createdPaths,
    dailyEntries,
    latestEntry: {
      ...latestEntry,
      structuredReport: latestStructuredReport,
    },
    visibleEntry,
    memoryCandidate,
    abilityNode,
    rootAbilityNode,
    confirmedAbilityEvidence,
    candidateAbilityEvidence,
    seededExternalSource,
    seededProject,
    resumeMaterialCandidate,
  };
}

async function createDailyEntryFixture({ rawContent, recordedAt, metrics, structuredReport }) {
  const entry = await apiJson("/api/daily-entries", {
    method: "POST",
    body: {
      rawContent,
      recordedAt,
    },
  });

  for (const [metricType, score] of Object.entries(metrics)) {
    await apiJson(`/api/daily-entries/${entry.id}/metric-ratings`, {
      method: "POST",
      body: {
        metricType,
        aiScore: score,
        userScore: score,
        finalScore: score,
        aiReason: `${runTag} UI 锚点已确认分数：${metricType}`,
        confirmedByUser: true,
      },
    });
  }

  await apiJson("/api/structured-daily-reports", {
    method: "POST",
    body: {
      dailyEntryId: entry.id,
      ...structuredReport,
    },
  });

  return {
    id: entry.id,
    rawContent,
    recordedAt,
    metrics,
    structuredReport,
  };
}

async function gotoPath(activePage, pathname) {
  await activePage.goto(`${webBaseUrl}${pathname}`, {
    waitUntil: "domcontentloaded",
  });
}

async function expectHeading(activePage, text) {
  await activePage.getByRole("heading", { level: 1, name: text }).waitFor();
}

async function expectText(activePage, text) {
  await activePage.getByText(text, { exact: false }).first().waitFor();
}

async function expectTextToDisappear(activePage, text) {
  await activePage.getByText(text, { exact: false }).first().waitFor({
    state: "detached",
    timeout: UI_TIMEOUT_MS,
  });
}

async function assertNoFatalPageState(activePage) {
  const bodyText = await activePage.locator("body").innerText();
  const fatalMarkers = [
    "This page could not be found",
    "Application error",
    "Unhandled Runtime Error",
    "Cannot read properties of undefined",
    "Failed to fetch",
  ];

  for (const marker of fatalMarkers) {
    assert(
      !bodyText.includes(marker),
      `page body should not include fatal marker: ${marker}`,
    );
  }
}

async function saveScreenshot(activePage, filename) {
  const target = path.join(evidenceDir, filename);
  await activePage.screenshot({
    path: target,
    fullPage: true,
  });
  return target;
}

async function runPageStep(name, callback) {
  const startedAt = Date.now();
  logStep(`Running page step: ${name}`);

  try {
    await callback();
    const elapsedMs = Date.now() - startedAt;
    pageResults.push({ name, status: "passed", elapsedMs });
    logPass(`${name} passed in ${elapsedMs}ms`);
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    pageResults.push({
      name,
      status: "failed",
      elapsedMs,
      error: formatError(error),
    });
    throw new Error(`${name} failed: ${formatError(error)}`);
  }
}

async function writeArtifacts({ status, seed = null, error = null }) {
  const endedAt = new Date();
  const summaryLines = [
    "# Web UI Smoke Summary",
    "",
    `- 状态：${status === "passed" ? "passed" : "failed"}`,
    `- 执行时间：${runStartedAt.toISOString()} -> ${endedAt.toISOString()}`,
    `- Web：\`${webBaseUrl}\``,
    `- API：\`${apiBaseUrl}\``,
    `- Run tag：\`${runTag}\``,
    `- Headless：\`${headless}\``,
    "",
    "## 覆盖页面",
    "",
    "- `/`",
    "- `/daily-entry/today`",
    "- `/memories/review`",
    "- `/ability-tree`",
    "- `/weekly-review`",
    "- `/external-sources`",
    "- `/projects`",
    "",
    "## 实际动作",
    "",
    "- 通过 API 创建隔离的 active 决策、4 条路径、30 条 DailyEntry、已确认指标、结构化日报、候选长期记忆、能力节点、能力证据、外部来源和项目。",
    "- 另外补 1 条专用 UI 锚点 DailyEntry，避免脚本依赖“第 30 天记录一定出现在最近记录第一页”的假设。",
    "- 在浏览器中验证首页、每日记录、长期记忆确认、能力树、周复盘、外部来源、项目页的标题与关键文案。",
    "- 在 `/weekly-review` 触发 deterministic 周复盘生成，并验证数据来源统计、六块复盘内容和边界提示可见。",
    "- 对脚本自己创建的数据执行安全交互：确认候选长期记忆、确认候选能力证据、通过 fake provider 搜索并保存外部来源、勾选 2 条已保存来源生成路径影响草稿、校验草稿确认前不会自动写入路径证据、由用户动作确认写入正式决策证据并回显 sourceCitationId / 来源追溯、新增并删除临时外部来源、通过 UI 新增临时项目并通过 API 清理。",
    "- 在 `/projects` 执行候选简历素材确认、deterministic 目标岗位差距分析和 deterministic 项目包装建议生成。",
    "",
    "## 页面结果",
    "",
    ...pageResults.map((result) =>
      `- ${result.name}: ${result.status}${result.error ? ` - ${result.error}` : ""}`,
    ),
    "",
    "## 30 天模拟关键数据",
    "",
    seed
      ? `- 决策标题：${seed.decision.title}`
      : "- 决策标题：未写入（执行失败前中断）",
    seed
      ? `- DailyEntry 数量：${seed.dailyEntries.length}`
      : "- DailyEntry 数量：未写入（执行失败前中断）",
    seed
      ? `- 最新记录：${seed.latestEntry.rawContent}`
      : "- 最新记录：未写入（执行失败前中断）",
    seed
      ? `- UI 锚点记录：${seed.visibleEntry.rawContent}`
      : "- UI 锚点记录：未写入（执行失败前中断）",
    seed
      ? `- 候选记忆：${seed.memoryCandidate.content}`
      : "- 候选记忆：未写入（执行失败前中断）",
    seed
      ? `- 能力节点：${seed.abilityNode.name}`
      : "- 能力节点：未写入（执行失败前中断）",
    seed
      ? `- 已登记来源：${seed.seededExternalSource.title}`
      : "- 已登记来源：未写入（执行失败前中断）",
    seed
      ? `- 已登记项目：${seed.seededProject.name}`
      : "- 已登记项目：未写入（执行失败前中断）",
    "",
    "## 未覆盖项",
    "",
    "- 外部信息搜索仅覆盖 fake provider 的本地确定性保存链路，以及路径影响草稿到人工确认写入证据的 UI 闭环；未覆盖真实搜索结果质量、抓取与模型摘要质量。",
    "- 未覆盖飞书提醒、飞书会话或其他 Feishu 链路。",
    "- 未覆盖简历文件上传、PDF / Word 解析与真实 AI 岗位匹配质量评估。",
    "- 项目包装建议只覆盖 deterministic first-pass 页面交互，不代表真实 AI 简历润色质量。",
    "- `/weekly-review` 覆盖 deterministic 周复盘生成和页面展示，但不代表真实 AI 深度周报质量已完成。",
    "- 未在 UI 中验证结构化日报 AI 生成按钮对应的真实模型质量。",
    "",
    "## 产物",
    "",
    "- `01-home.png`",
    "- `02-daily-entry-today.png`",
    "- `03-memories-review.png`",
    "- `04-ability-tree.png`",
    "- `05-weekly-review.png`",
    "- `06-external-sources-draft.png`",
    "- `07-external-sources-confirmed.png`",
    "- `08-projects.png`",
    "- `summary.md`",
    "- `seed-data.json`",
    "- `terminal-log.txt`",
    "- `browser-console.txt`",
    "",
    error ? `## 失败信息\n\n\`\`\`\n${error}\n\`\`\`\n` : "",
  ];

  await Promise.all([
    writeFile(path.join(evidenceDir, "summary.md"), summaryLines.join("\n"), "utf8"),
    writeFile(path.join(evidenceDir, "seed-data.json"), JSON.stringify(seed, null, 2), "utf8"),
    writeFile(path.join(evidenceDir, "terminal-log.txt"), logs.join("\n"), "utf8"),
    writeFile(path.join(evidenceDir, "browser-console.txt"), [...consoleEvents, ...pageErrors].join("\n"), "utf8"),
  ]);
}

async function ensureApiHealthy() {
  const response = await fetch(`${apiBaseUrl}${DEFAULT_API_HEALTH_PATH}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }).catch((error) => {
    throw new Error(`API health check failed: ${formatError(error)}`);
  });

  assert.equal(response.ok, true, `API health check should return 200, received ${response.status}`);
}

async function ensureWebReachable() {
  const response = await fetch(webBaseUrl, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }).catch((error) => {
    throw new Error(`Web reachability check failed: ${formatError(error)}`);
  });

  assert.equal(response.ok, true, `Web reachability check should return 200, received ${response.status}`);
}

async function apiJson(pathname, options = {}) {
  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const rawText = await response.text();
  const payload = rawText ? safeJsonParse(rawText) : null;

  if (!response.ok) {
    const message =
      payload?.error?.message ??
      `${options.method ?? "GET"} ${pathname} returned ${response.status}`;
    throw new Error(message);
  }

  if (!payload || payload.error || payload.data == null) {
    throw new Error(
      `${options.method ?? "GET"} ${pathname} returned an invalid API envelope`,
    );
  }

  return payload.data;
}

async function findProjectByName(projectName) {
  const projects = await apiJson("/api/projects?limit=50&offset=0");
  return projects.items.find((item) => item.name === projectName) ?? null;
}

async function apiDeleteOk(pathname) {
  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    method: "DELETE",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  assert.equal(response.status, 204, `${pathname} should return 204 on delete`);
}

async function getPathEvidenceCount(decisionId) {
  const detail = await apiJson(`/api/life-decisions/${decisionId}`);
  return detail.paths.reduce(
    (total, currentPath) => total + currentPath.evidenceItems.length,
    0,
  );
}

async function getSinglePathEvidence(decisionId) {
  const detail = await apiJson(`/api/life-decisions/${decisionId}`);
  const evidenceItems = detail.paths.flatMap((pathItem) => pathItem.evidenceItems);

  assert.equal(
    evidenceItems.length,
    1,
    `decision ${decisionId} should expose exactly one confirmed path evidence item`,
  );

  return evidenceItems[0];
}

async function waitForPathEvidenceCount(decisionId, expectedCount) {
  const deadline = Date.now() + UI_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const currentCount = await getPathEvidenceCount(decisionId);
    if (currentCount === expectedCount) {
      return currentCount;
    }

    await delay(250);
  }

  const finalCount = await getPathEvidenceCount(decisionId);
  assert.equal(
    finalCount,
    expectedCount,
    `decision ${decisionId} should have ${expectedCount} path evidence items after UI confirmation`,
  );
  return finalCount;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function formatTimestamp(value) {
  const pad = (input) => String(input).padStart(2, "0");

  return [
    value.getFullYear(),
    pad(value.getMonth() + 1),
    pad(value.getDate()),
  ].join("") + `-${pad(value.getHours())}${pad(value.getMinutes())}${pad(value.getSeconds())}`;
}

function formatError(error) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

function logStep(message) {
  log(`[step] ${message}`);
}

function logPass(message) {
  log(`[pass] ${message}`);
}

function logFail(message) {
  log(`[fail] ${message}`);
}

function log(message) {
  const line = `${new Date().toISOString()} ${message}`;
  logs.push(line);
  console.log(line);
}
