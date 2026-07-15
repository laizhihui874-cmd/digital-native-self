#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_API_BASE_URL = "http://localhost:3001";
const apiBaseUrl = normalizeBaseUrl(process.env.MONTH_SIM_API_BASE_URL ?? process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL);
const evidenceDir = path.resolve(
  "specs/digital-self-mvp/test-evidence/month-simulation-20260619",
);
const requestTimeoutMs = 10_000;
const runTag = `month-sim-20260619-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;

const metricTypes = [
  "growth",
  "emotional_drain",
  "long_term_fit",
  "communication_pressure",
];

const pathTitles = [
  "继续当前工作",
  "离职考研",
  "换工作",
  "边工作边准备",
];

const terminalLog = [];

const evidence = {
  apiBaseUrl,
  generatedAt: new Date().toISOString(),
  runTag,
  lifeDecisionId: null,
  pathIds: {},
  dailyEntryIds: [],
  metricRatings: [],
  memoryIds: [],
  abilityNodeIds: {},
  abilityEvidenceIds: [],
  decisionEvidenceIds: [],
  externalSourceIds: [],
  projectIds: [],
};

try {
  log(`Using API base URL: ${apiBaseUrl}`);
  await ensureApiHealthy();
  await mkdir(evidenceDir, { recursive: true });

  const decision = await createLifeDecision();
  evidence.lifeDecisionId = decision.id;
  log(`Created LifeDecision ${decision.id}`);

  const paths = await createDecisionPaths(decision.id);
  for (const item of paths) {
    evidence.pathIds[item.title] = item.id;
  }
  log(`Created ${paths.length} decision paths`);

  const abilityNodes = await createAbilityNodes();
  for (const node of abilityNodes) {
    evidence.abilityNodeIds[node.name] = node.id;
  }
  log(`Created ${abilityNodes.length} ability nodes`);

  const days = buildThirtyDayScenario();
  const dayRecords = [];

  for (const day of days) {
    const dailyEntry = await apiRequest("/api/daily-entries", {
      method: "POST",
      body: {
        source: "web",
        rawContent: day.rawContent,
        recordedAt: day.recordedAt,
      },
    });
    evidence.dailyEntryIds.push(dailyEntry.id);

    for (const metric of metricTypes) {
      const rating = await apiRequest(`/api/daily-entries/${dailyEntry.id}/metric-ratings`, {
        method: "POST",
        body: {
          metricType: metric,
          userScore: day.metrics[metric],
          finalScore: day.metrics[metric],
          aiReason: `30 天模拟用户确认分：${metricReason(metric, day)}`,
          confirmedByUser: true,
        },
      });
      evidence.metricRatings.push({
        dailyEntryId: dailyEntry.id,
        metricType: rating.metricType,
        finalScore: rating.finalScore,
        confirmedByUser: rating.confirmedByUser,
      });
    }

    dayRecords.push({
      day: day.day,
      date: day.date,
      rawContent: day.rawContent,
      mood: day.mood,
      action: day.action,
      metrics: day.metrics,
      dailyEntryId: dailyEntry.id,
    });
  }
  log(`Created ${dayRecords.length} DailyEntry records and ${evidence.metricRatings.length} MetricRating records`);

  const memories = await createMemories();
  evidence.memoryIds.push(...memories.map((item) => item.id));
  log(`Created ${memories.length} memories`);

  const abilityEvidence = await createAbilityEvidence(abilityNodes);
  evidence.abilityEvidenceIds.push(...abilityEvidence.map((item) => item.id));
  log(`Created and confirmed ${abilityEvidence.length} ability evidence records`);

  const decisionEvidence = await createDecisionEvidence(decision.id, paths);
  evidence.decisionEvidenceIds.push(...decisionEvidence.map((item) => item.id));
  log(`Created ${decisionEvidence.length} decision evidence records`);

  const externalSources = await createExternalSources(decision.id);
  evidence.externalSourceIds.push(...externalSources.map((item) => item.id));
  log(`Created ${externalSources.length} manual external sources`);

  const project = await apiRequest("/api/projects", {
    method: "POST",
    body: {
      name: `${runTag} 数字原生自我 MVP`,
      description: "30 天关键决策模拟中沉淀的个人成长与决策工作台项目。",
      role: "AI 应用开发 / 产品实现 / 测试设计",
      startDate: "2026-06-03T00:00:00.000Z",
      endDate: "2026-07-02T00:00:00.000Z",
      status: "active",
      outcomes: [
        "跑通每日记录、长期记忆、能力证据和项目经历最小闭环",
        "形成围绕 2026-07-02 决策的证据化复盘材料",
        "明确项目包装建议和简历差距分析仍需后续接入",
      ],
      resumeSummary: "独立搭建 AI 个人成长与决策工作台 MVP，完成多模块数据闭环、自动化回归和 30 天关键决策模拟证据归档。",
      abilityEvidenceIds: abilityEvidence.slice(0, 4).map((item) => item.id),
    },
  });
  evidence.projectIds.push(project.id);
  log(`Created project ${project.id}`);

  const decisionDetail = await apiRequest(`/api/life-decisions/${decision.id}`);
  const projectDetail = await apiRequest(`/api/projects/${project.id}`);

  await writeEvidenceFiles({
    decision,
    paths,
    days: dayRecords,
    memories,
    abilityNodes,
    abilityEvidence,
    decisionEvidence,
    externalSources,
    project,
    decisionDetail,
    projectDetail,
  });

  log(`Evidence written to ${evidenceDir}`);
  log("Month decision simulation completed");
} catch (error) {
  log(`FAIL ${formatError(error)}`);
  try {
    await mkdir(evidenceDir, { recursive: true });
    await writeFile(path.join(evidenceDir, "terminal-log.txt"), terminalLog.join("\n"), "utf8");
  } catch {
    // Best-effort failure logging only.
  }
  process.exitCode = 1;
}

async function ensureApiHealthy() {
  const response = await fetch(`${apiBaseUrl}/api/health`, {
    signal: AbortSignal.timeout(2_000),
  }).catch((error) => {
    throw new Error(`API health check failed: ${formatError(error)}`);
  });

  if (!response.ok) {
    throw new Error(`API health check returned ${response.status}`);
  }
}

async function createLifeDecision() {
  return apiRequest("/api/life-decisions", {
    method: "POST",
    body: {
      title: `${runTag}：2026-07-02 前关键路径选择`,
      description:
        "模拟用户需要在继续当前工作、离职考研、换工作、边工作边准备之间做证据化判断，避免只凭当下情绪下结论。",
      deadline: "2026-07-02T00:00:00.000Z",
      status: "active",
      finalDecision: "模拟期结束前保持开放；只记录证据倾向，不替用户做绝对决定。",
    },
  });
}

async function createDecisionPaths(decisionId) {
  const configs = [
    {
      title: "继续当前工作",
      description: "保留收入和真实职场样本，观察是否能从低价值任务转向可积累项目。",
      benefits: ["现金流稳定", "继续获取职场沟通样本", "可把真实工作转化为项目证据"],
      risks: ["低端重复任务持续", "情绪消耗累积", "7 月 2 日窗口期被动压缩"],
      currentScore: 63,
    },
    {
      title: "离职考研",
      description: "释放时间备考外国哲学，争取通过升学重建环境和思辨训练。",
      benefits: ["时间集中", "哲学兴趣匹配", "暂时退出高压职场环境"],
      risks: ["机会成本高", "考研不确定", "AI 应用项目经验可能断档"],
      currentScore: 57,
    },
    {
      title: "换工作",
      description: "寻找更有培养体系、更贴近 AI 应用开发的公司或团队。",
      benefits: ["方向可能更匹配", "有机会进入更大平台", "能降低当前关系和环境消耗"],
      risks: ["简历项目不足", "面试表达仍需训练", "短期求职压力高"],
      currentScore: 66,
    },
    {
      title: "边工作边准备",
      description: "保留当前收入和身份弹性，同时推进考研、简历和项目整理。",
      benefits: ["保留多条路径", "风险相对可控", "能用周复盘观察真实负荷"],
      risks: ["双线推进容易透支", "需要严格时间管理", "如果工作继续低价值会拖慢准备"],
      currentScore: 71,
    },
  ];

  const created = [];
  for (const config of configs) {
    created.push(await apiRequest(`/api/life-decisions/${decisionId}/paths`, {
      method: "POST",
      body: config,
    }));
  }

  return created;
}

async function createAbilityNodes() {
  const configs = [
    ["表达", "把复杂想法说清楚，尤其是向同事解释方案和向面试官表达项目价值。"],
    ["判断", "区分事实、情绪、推测和长期价值，避免在疲惫时做大决定。"],
    ["沟通", "在职场任务反馈、需求澄清和协作中建立更明确的标准。"],
    ["专业能力", "围绕 AI 应用工程、API 对接、模型效果测试和产品化交付的实际能力。"],
  ];

  const created = [];
  for (const [name, description] of configs) {
    created.push(await apiRequest("/api/ability-nodes", {
      method: "POST",
      body: {
        name: `${runTag}-${name}`,
        description,
      },
    }));
  }
  return created;
}

async function createMemories() {
  const configs = [
    ["goal", "7 月 2 日前的真实目标不是逃离，而是基于证据判断工作、考研、换工作和双线准备哪条路径更稳。", "confirmed"],
    ["ability", "当把任务拆成接口、页面、验证脚本和证据归档时，执行掌控感明显上升。", "confirmed"],
    ["recurring_problem", "高压反馈后容易把事实问题扩大成自我否定，需要先做事实/情绪分离。", "confirmed"],
    ["decision", "边工作边准备在模拟中多次表现为风险较低的过渡路径，但前提是每周能稳定产出证据。", "confirmed"],
    ["value", "希望工作不仅是完成低价值任务，还要能沉淀项目、能力和自我理解。", "candidate"],
    ["event", "完成数字原生自我 MVP 的测试计划、项目页和 30 天模拟，成为可写入简历的阶段性经历。", "confirmed"],
  ];

  const created = [];
  for (const [memoryType, content, status] of configs) {
    created.push(await apiRequest("/api/memories", {
      method: "POST",
      body: {
        memoryType,
        content: `${runTag}：${content}`,
        status,
        confidence: status === "confirmed" ? 0.86 : 0.68,
        isMomentaryThought: false,
      },
    }));
  }
  return created;
}

async function createAbilityEvidence(nodes) {
  const byName = Object.fromEntries(nodes.map((node) => [node.name.replace(`${runTag}-`, ""), node]));
  const configs = [
    ["表达", "把 30 天模拟结果拆成 run-meta、day log、decision summary 和 final review，方便后续回看。", 3, 4, 4, 1],
    ["判断", "在最终复盘中只给证据倾向，不把边工作边准备包装成绝对答案。", 4, 4, 5, 1],
    ["沟通", "测试剧本明确每一步输入、期望结果、证据留存和失败记录格式，降低协作歧义。", 3, 4, 4, 1],
    ["专业能力", "通过 API 写入 LifeDecision、DailyEntry、MetricRating、Memory、AbilityEvidence、Project 并归档证据。", 4, 5, 5, 2],
    ["专业能力", "统一自动化回归入口通过，说明后端 API、Web build、MCP smoke 的基础稳定性提升。", 4, 4, 5, 2],
  ];

  const confirmed = [];
  for (const [nodeName, content, difficultyScore, independenceScore, impactScore, feedbackScore] of configs) {
    const candidate = await apiRequest("/api/ability-evidence", {
      method: "POST",
      body: {
        abilityNodeId: byName[nodeName].id,
        content: `${runTag}：${content}`,
        impact: "positive",
        difficultyScore,
        independenceScore,
        impactScore,
        feedbackScore,
        recurrenceCount: 1,
        status: "candidate",
      },
    });

    confirmed.push(await apiRequest(`/api/ability-evidence/${candidate.id}/review`, {
      method: "PATCH",
      body: {
        status: "confirmed",
        content: candidate.content,
        impact: candidate.impact,
        difficultyScore: candidate.difficultyScore,
        independenceScore: candidate.independenceScore,
        impactScore: candidate.impactScore,
        feedbackScore: candidate.feedbackScore,
        recurrenceCount: candidate.recurrenceCount,
      },
    }));
  }
  return confirmed;
}

async function createDecisionEvidence(decisionId, paths) {
  const pathByTitle = Object.fromEntries(paths.map((item) => [item.title, item]));
  const configs = [
    ["继续当前工作", "support", "继续工作提供稳定现金流，也提供真实职场沟通和任务反馈样本。", 0.62],
    ["继续当前工作", "against", "如果任务持续停留在平台查找、接口对接和低价值测试，技术深度积累不足。", 0.78],
    ["离职考研", "support", "离职能显著释放备考时间，哲学兴趣和思辨训练与长期自我建设相关。", 0.58],
    ["离职考研", "against", "考研存在不确定性，且中断 AI 应用项目积累会提高后续求职成本。", 0.72],
    ["换工作", "support", "若能进入有培养体系的大平台，AI 应用开发和表达训练都有更明确增益。", 0.76],
    ["换工作", "against", "当前简历项目、面试表达和学校背景仍是短期短板，需要先补素材。", 0.68],
    ["边工作边准备", "support", "模拟中该路径保留收入、身份和备考/求职弹性，短期风险最低。", 0.84],
    ["边工作边准备", "against", "双线推进会放大体力消耗，如果工作继续高压低价值，需要及时止损。", 0.66],
  ];

  const created = [];
  for (const [pathTitle, evidenceType, content, weight] of configs) {
    created.push(await apiRequest("/api/decision-evidence", {
      method: "POST",
      body: {
        decisionId,
        pathId: pathByTitle[pathTitle].id,
        evidenceType,
        content: `${runTag}：${content}`,
        weight,
      },
    }));
  }
  return created;
}

async function createExternalSources(decisionId) {
  const configs = [
    ["广州 AI 应用开发岗位 JD 手动样例", "模拟招聘站点", "https://example.com/jobs/ai-application-engineer-guangzhou", "手动模拟来源：岗位要求集中在 API 集成、模型调用、业务理解和项目交付。", "用于评估换工作与继续工作的技能匹配。"],
    ["华南师范大学外国哲学考研信息手动样例", "模拟学校官网", "https://example.com/scnu/philosophy-admission", "手动模拟来源：需要确认招生计划、参考书目和备考时间线。", "用于评估离职考研和边工作边准备的现实成本。"],
    ["AI 应用岗位趋势手动样例", "模拟行业文章", "https://example.com/research/ai-application-trend-2026", "手动模拟来源：应用层岗位强调落地、工具链和业务场景，而非单纯算法。", "支持把数字原生自我 MVP 作为简历项目继续打磨。"],
    ["应届生培养体系手动样例", "模拟公司招聘页", "https://example.com/campus-training/ai-product-engineer", "手动模拟来源：有培养体系的团队通常要求清晰项目表达和协作基本功。", "用于评估换工作前必须补齐简历项目和面试表达。"],
  ];

  const created = [];
  for (const [title, sourceSite, url, summary, relationToDecision] of configs) {
    created.push(await apiRequest("/api/external-sources", {
      method: "POST",
      body: {
        lifeDecisionId: decisionId,
        title: `${runTag}：${title}`,
        sourceSite,
        url,
        publishedAt: "2026-06-19T00:00:00.000Z",
        summary,
        relationToDecision,
      },
    }));
  }
  return created;
}

function buildThirtyDayScenario() {
  const start = new Date("2026-06-03T20:30:00.000Z");
  const themes = [
    ["工作低价值感明显", "整理今天对接口和测试返回的细节，感到任务偏低端，但记录后发现能提炼出 API 调试经验。", "把低价值感拆成事实和情绪。"],
    ["沟通返工", "被要求返工说明文档，情绪有点下沉，但这次把标准问清楚了。", "补一版更清楚的任务说明。"],
    ["考研想法变强", "晚上看了外国哲学资料，觉得回学校能给自己空间，但也担心逃离意味太强。", "列出考研收益和风险。"],
    ["项目推进", "把数字原生自我里的每日记录闭环又梳理了一遍，开始觉得项目能写进简历。", "继续补项目证据。"],
    ["孤独感", "下班后在广州一个人吃饭，孤独感很强，差点把这等同于不适合上班。", "区分城市孤独和职业判断。"],
    ["外部岗位信息", "看了几条 AI 应用岗位 JD，发现很多要求是项目表达、模型调用和业务理解。", "整理 JD 要求。"],
    ["周复盘", "复盘发现本周不是没有成长，而是成长证据散落在接口、测试和沟通返工里。", "把证据挂到能力树。"],
  ];

  return Array.from({ length: 30 }, (_, index) => {
    const day = index + 1;
    const date = new Date(start.getTime() + index * 24 * 60 * 60 * 1000);
    const [theme, detail, action] = themes[index % themes.length];
    const phase = index < 10 ? "前期焦虑较高" : index < 20 ? "中期开始积累证据" : "后期倾向更清晰";
    const growth = clampScore(2 + Math.floor(index / 8) + (index % 5 === 0 ? 1 : 0));
    const emotionalDrain = clampScore(index < 8 ? 5 - (index % 2) : index < 20 ? 4 - (index % 3 === 0 ? 1 : 0) : 3);
    const longTermFit = clampScore(index < 10 ? 2 + (index % 3 === 0 ? 1 : 0) : index < 20 ? 3 : 4);
    const communicationPressure = clampScore(index < 12 ? 4 + (index % 4 === 0 ? 1 : 0) : index < 24 ? 4 : 3);

    return {
      day,
      date: date.toISOString().slice(0, 10),
      recordedAt: date.toISOString(),
      mood: phase,
      action,
      metrics: {
        growth,
        emotional_drain: emotionalDrain,
        long_term_fit: longTermFit,
        communication_pressure: communicationPressure,
      },
      rawContent:
        `${runTag} Day ${String(day).padStart(2, "0")}：${theme}。\n` +
        `${detail}\n` +
        `今天围绕 2026-07-02 决策继续收集证据。当前不会直接下结论，而是观察继续工作、离职考研、换工作、边工作边准备四条路径的真实成本。\n` +
        `明天行动：${action}`,
    };
  });
}

async function writeEvidenceFiles(context) {
  await writeFile(path.join(evidenceDir, "api-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(path.join(evidenceDir, "terminal-log.txt"), `${terminalLog.join("\n")}\n`, "utf8");

  await writeFile(
    path.join(evidenceDir, "run-meta.md"),
    [
      "# Month Simulation Run Meta",
      "",
      `- Generated at: ${evidence.generatedAt}`,
      `- API base URL: ${apiBaseUrl}`,
      "- Scenario: 2026-07-02 前决定继续工作 / 离职考研 / 换工作 / 边工作边准备",
      "- Method: Deterministic local simulation through implemented REST APIs",
      "- Boundary: No Feishu, no real web search, no resume gap analysis, no AI project packaging generated",
      "- User confirmation model: This script simulates the user confirming selected memories, ability evidence, and metric ratings",
      "",
    ].join("\n"),
    "utf8",
  );

  await writeFile(
    path.join(evidenceDir, "day-by-day-log.md"),
    [
      "# 30 天逐日模拟日志",
      "",
      ...context.days.flatMap((day) => [
        `## Day ${String(day.day).padStart(2, "0")} - ${day.date}`,
        "",
        `- DailyEntry ID: \`${day.dailyEntryId}\``,
        `- 情绪阶段: ${day.mood}`,
        `- 明日行动: ${day.action}`,
        `- 指标: 成长性 ${day.metrics.growth}/5，情绪消耗 ${day.metrics.emotional_drain}/5，长期匹配 ${day.metrics.long_term_fit}/5，沟通压力 ${day.metrics.communication_pressure}/5`,
        "",
        day.rawContent,
        "",
      ]),
    ].join("\n"),
    "utf8",
  );

  const evidenceByPath = groupBy(context.decisionEvidence, (item) => {
    const path = context.paths.find((candidate) => candidate.id === item.pathId);
    return path?.title ?? "未识别路径";
  });

  await writeFile(
    path.join(evidenceDir, "decision-evidence-summary.md"),
    [
      "# Decision Evidence Summary",
      "",
      `- LifeDecision ID: \`${context.decision.id}\``,
      `- 证据总数: ${context.decisionEvidence.length}`,
      "",
      ...pathTitles.flatMap((title) => [
        `## ${title}`,
        "",
        ...(evidenceByPath[title] ?? []).map(
          (item) => `- ${item.evidenceType} / weight ${item.weight ?? "未设置"}：${item.content}`,
        ),
        "",
      ]),
      "## 手动外部来源",
      "",
      ...context.externalSources.map((item) => `- [${item.title}](${item.url}) - ${item.sourceSite}：${item.summary}`),
      "",
    ].join("\n"),
    "utf8",
  );

  await writeFile(
    path.join(evidenceDir, "final-review.md"),
    [
      "# 30 天关键决策模拟复盘",
      "",
      "## 克制结论",
      "",
      "模拟期内，`边工作边准备`呈现为当前风险最低的过渡方案：它保留收入、身份和项目证据积累，同时不关闭考研与换工作的选项。但这不是绝对建议，只是基于本轮模拟证据的阶段性倾向。",
      "",
      "## 四条路径倾向",
      "",
      "- 继续当前工作：适合作为短期观察位，但如果低价值任务持续且无培养收益，需要设置止损点。",
      "- 离职考研：兴趣和时间收益明确，但机会成本和不确定性仍高，不宜只由情绪推动。",
      "- 换工作：长期匹配可能更好，但需要先补项目表达、简历素材和面试沟通证据。",
      "- 边工作边准备：当前最稳，但必须每周复盘体力消耗和真实产出，避免双线失速。",
      "",
      "## 主要风险",
      "",
      "- 模拟数据不是现实数据，不能替代用户真实 30 天记录。",
      "- 外部信息是手动模拟来源，不是真实联网搜索。",
      "- 未接入真实项目包装建议和简历差距分析。",
      "- 当前周复盘页面仍不是完整真实生成闭环。",
      "",
      "## 下一步行动",
      "",
      "1. 用真实每日记录替换模拟 DailyEntry。",
      "2. 补简历文本 / 文件导入，让项目经历能进入简历包装链路。",
      "3. 对 `/daily-entry/today`、`/ability-tree`、`/projects` 做浏览器级 smoke。",
      "4. 在 2026-07-02 前做一次真实复盘，而不是只看模拟结论。",
      "",
      "## 关键 ID",
      "",
      `- LifeDecision: \`${context.decision.id}\``,
      `- Project: \`${context.project.id}\``,
      `- Project detail evidence count: ${context.projectDetail.abilityEvidenceItems.length}`,
      `- Decision detail paths: ${context.decisionDetail.paths.length}`,
      "",
    ].join("\n"),
    "utf8",
  );
}

async function apiRequest(pathname, options = {}) {
  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(requestTimeoutMs),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok || payload?.error) {
    throw new Error(`${options.method ?? "GET"} ${pathname} failed with ${response.status}: ${text}`);
  }

  return payload?.data ?? null;
}

function metricReason(metric, day) {
  const labels = {
    growth: "本日是否沉淀能力或项目证据",
    emotional_drain: "本日情绪消耗强度",
    long_term_fit: "本日行动和长期方向的贴合度",
    communication_pressure: "本日沟通压力和返工压力",
  };
  return `${labels[metric]}；Day ${day.day} 分数为 ${day.metrics[metric]}`;
}

function groupBy(items, getKey) {
  return items.reduce((result, item) => {
    const key = getKey(item);
    result[key] ??= [];
    result[key].push(item);
    return result;
  }, {});
}

function clampScore(value) {
  return Math.min(5, Math.max(1, value));
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function log(message) {
  const line = `[month-sim] ${message}`;
  terminalLog.push(line);
  console.log(line);
}

function formatError(error) {
  return error instanceof Error ? error.stack ?? error.message : String(error);
}
