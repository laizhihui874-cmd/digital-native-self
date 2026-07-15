import type {
  DailyGuideAgentInput,
  DailyGuideAgentOutput,
  SufficiencyCheckAgentInput,
  SufficiencyCheckAgentOutput,
  SufficiencyStatus,
  ThemeStatus,
} from "./agent-io";
import type { AgentDefinition, AgentExecutionResult } from "./orchestrator";

const dailySectionKeywords = {
  facts: ["做了", "完成", "推进", "处理", "测试", "对接", "会议", "学习"],
  emotions: ["焦虑", "开心", "难受", "累", "压力", "迷茫", "烦", "沮丧", "平静"],
  difficulties: ["困难", "卡", "问题", "不顺", "返工", "被骂", "不会", "冲突"],
  learnings: ["收获", "学到", "意识到", "复盘", "发现", "总结"],
  next_actions: ["明天", "下周", "接下来", "准备", "计划", "继续"],
  growth_evidence: ["能力", "表达", "沟通", "判断", "专业", "独立", "项目"],
  decision_impact: ["工作", "考研", "离职", "换工作", "职业", "路径", "选择"],
} as const;

const requiredSectionLabels = {
  facts: "今天做了什么",
  emotions: "情绪如何",
  difficulties: "遇到什么困难",
  learnings: "有什么收获",
  next_actions: "明天推进什么",
  growth_evidence: "有什么能力成长证据",
  decision_impact: "这件事如何影响当前人生节点判断",
} as const;

export const DailyGuideAgent: AgentDefinition<
  DailyGuideAgentInput,
  DailyGuideAgentOutput
> = {
  name: "DailyGuideAgent",
  description:
    "Deterministic MVP agent that asks one focused follow-up question for daily journaling.",
  async run(input): Promise<AgentExecutionResult<DailyGuideAgentOutput>> {
    const startedAt = Date.now();
    const text = [
      input.currentMessage,
      input.recentSevenDaySummary ?? "",
      input.currentLifeDecisionSummary ?? "",
    ].join("\n");
    const missing = getMissingSections(input.currentMessage, [
      "facts",
      "emotions",
      "difficulties",
      "learnings",
      "next_actions",
      "growth_evidence",
      "decision_impact",
    ]);
    const themeStatus = getThemeStatus(text, input.currentLifeDecisionSummary);
    const nextGap = missing[0] ?? "decision_impact";

    return {
      agentName: "DailyGuideAgent",
      latencyMs: Date.now() - startedAt,
      output: {
        followUpQuestion: buildFollowUpQuestion(nextGap, themeStatus),
        themeStatus,
        informationGaps: missing.map((section) => requiredSectionLabels[section]),
        provisionalSummary: summarizeText(input.currentMessage),
        suggestedNextAgent:
          missing.length <= 1 ? "SufficiencyCheckAgent" : "EmotionFactSplitAgent",
      },
    };
  },
};

export const SufficiencyCheckAgent: AgentDefinition<
  SufficiencyCheckAgentInput,
  SufficiencyCheckAgentOutput
> = {
  name: "SufficiencyCheckAgent",
  description:
    "Deterministic MVP agent that checks whether a daily record has enough information.",
  async run(input): Promise<AgentExecutionResult<SufficiencyCheckAgentOutput>> {
    const startedAt = Date.now();
    const missingSections = getMissingSections(
      input.conversationTranscript,
      input.requiredSections,
    );
    const themeStatus = getThemeStatus(
      input.conversationTranscript,
      input.currentLifeDecisionSummary,
    );
    const sufficiencyStatus = getSufficiencyStatus(missingSections.length);

    return {
      agentName: "SufficiencyCheckAgent",
      latencyMs: Date.now() - startedAt,
      output: {
        sufficiencyStatus,
        themeStatus,
        missingInformation: missingSections.map((section) => requiredSectionLabels[section]),
        shouldContinueAsking:
          sufficiencyStatus !== "sufficient" || themeStatus === "off-topic",
        rationale: buildSufficiencyRationale(sufficiencyStatus, themeStatus, missingSections),
      },
    };
  },
};

type SectionKey = keyof typeof dailySectionKeywords;

function getMissingSections(text: string, requiredSections: readonly SectionKey[]): SectionKey[] {
  const normalized = normalizeText(text);

  return requiredSections.filter((section) => {
    const keywords = dailySectionKeywords[section];
    return !keywords.some((keyword) => normalized.includes(keyword));
  });
}

function getThemeStatus(text: string, currentLifeDecisionSummary?: string): ThemeStatus {
  const normalizedText = normalizeText(text);
  const decisionText = normalizeText(currentLifeDecisionSummary ?? "");

  if (!decisionText) {
    return "on-topic";
  }

  const decisionTokens = Array.from(
    new Set(
      decisionText
        .split(/[\s,，。；;：:、/]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2),
    ),
  );
  const matchedTokens = decisionTokens.filter((token) => normalizedText.includes(token));

  if (matchedTokens.length >= 2) {
    return "on-topic";
  }

  if (matchedTokens.length === 1 || dailySectionKeywords.decision_impact.some((keyword) => normalizedText.includes(keyword))) {
    return "partially-off-topic";
  }

  return "off-topic";
}

function getSufficiencyStatus(missingCount: number): SufficiencyStatus {
  if (missingCount === 0) {
    return "sufficient";
  }

  if (missingCount <= 2) {
    return "needs-follow-up";
  }

  return "insufficient";
}

function buildFollowUpQuestion(section: SectionKey, themeStatus: ThemeStatus): string {
  const prefix =
    themeStatus === "off-topic"
      ? "我先把话题拉回当前人生节点："
      : themeStatus === "partially-off-topic"
        ? "这个方向有点相关，我们再补一层："
        : "";

  return `${prefix}${requiredSectionLabels[section]}？请用一两句话补充事实，不需要一次写完。`;
}

function buildSufficiencyRationale(
  status: SufficiencyStatus,
  themeStatus: ThemeStatus,
  missingSections: SectionKey[],
): string {
  if (status === "sufficient" && themeStatus === "on-topic") {
    return "当前记录已经覆盖必要维度，可以进入结构化整理。";
  }

  const missing = missingSections.map((section) => requiredSectionLabels[section]).join("、");
  const themeNote =
    themeStatus === "on-topic"
      ? "主题没有明显偏离"
      : themeStatus === "partially-off-topic"
        ? "主题与当前节点部分相关"
        : "主题已经明显偏离当前节点";

  return `${themeNote}，还缺少：${missing || "无明显缺口"}。`;
}

function summarizeText(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "用户尚未提供有效记录。";
  }

  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}
