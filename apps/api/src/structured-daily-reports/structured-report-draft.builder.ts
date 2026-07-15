import type { CreateStructuredDailyReportRequest, StructuredTextItem } from "@digital-self/shared";

type BuildStructuredReportDraftInput = {
  dailyEntryId: string;
  rawContent: string;
};

const LOCAL_DRAFT_TITLE = "本地草稿";
const MAX_FACTS = 3;
const MAX_SECTION_ITEMS = 3;
const MAX_DETAIL_LENGTH = 180;

const FACT_KEYWORDS = [
  "完成",
  "推进",
  "处理",
  "解决",
  "修复",
  "沟通",
  "开会",
  "整理",
  "测试",
  "调研",
  "学习",
  "提交",
  "实现",
  "review",
  "fix",
  "ship",
  "build",
];

const EMOTION_KEYWORDS = [
  "开心",
  "高兴",
  "踏实",
  "轻松",
  "满足",
  "平静",
  "焦虑",
  "压力",
  "累",
  "疲惫",
  "迷茫",
  "孤独",
  "烦",
  "难受",
  "委屈",
  "崩溃",
  "消耗",
];

const WORK_ITEM_KEYWORDS = [
  "工作",
  "学习",
  "项目",
  "接口",
  "调研",
  "测试",
  "沟通",
  "开会",
  "需求",
  "文档",
  "代码",
  "开发",
  "修复",
  "实现",
  "联调",
  "脚本",
  "api",
];

const FEEDBACK_KEYWORDS = [
  "反馈",
  "返工",
  "被骂",
  "评价",
  "评审",
  "review",
  "批评",
  "表扬",
  "建议",
  "意见",
  "指出",
];

const GROWTH_KEYWORDS = [
  "学习",
  "学会",
  "表达",
  "专业",
  "独立",
  "优化",
  "理解",
  "掌握",
  "总结",
  "复盘",
];

const DRAIN_KEYWORDS = [
  "压力",
  "累",
  "疲惫",
  "迷茫",
  "孤独",
  "焦虑",
  "消耗",
  "通勤",
  "沟通不顺",
  "烦",
  "崩溃",
  "卡住",
  "担心",
  "加班",
];

const NEXT_ACTION_KEYWORDS = [
  "明天",
  "下周",
  "接下来",
  "准备",
  "计划",
  "待办",
  "之后",
  "下一步",
];

const DECISION_IMPACT_KEYWORDS = [
  "工作",
  "离职",
  "考研",
  "换工作",
  "应届",
  "7月2日",
  "职业选择",
  "继续做",
  "辞职",
  "读研",
  "offer",
];

export function buildLocalStructuredDailyReportDraft(
  input: BuildStructuredReportDraftInput,
): CreateStructuredDailyReportRequest {
  const sentences = splitRawContentIntoSentences(input.rawContent);

  return {
    dailyEntryId: input.dailyEntryId,
    facts: buildFacts(sentences),
    emotions: buildEmotions(sentences),
    workItems: buildSectionItems(sentences, WORK_ITEM_KEYWORDS),
    feedback: buildSectionItems(sentences, FEEDBACK_KEYWORDS),
    growthEvidence: buildSectionItems(sentences, GROWTH_KEYWORDS),
    drainSources: buildSectionItems(sentences, DRAIN_KEYWORDS),
    nextActions: buildSectionItems(sentences, NEXT_ACTION_KEYWORDS, extractNextActionDetail),
    decisionImpact: buildSectionItems(sentences, DECISION_IMPACT_KEYWORDS, extractDecisionImpactDetail),
  };
}

function buildFacts(sentences: string[]): StructuredTextItem[] {
  const prioritized = takeMatchingSentences(sentences, FACT_KEYWORDS, MAX_FACTS);
  const fallback = sentences.slice(0, MAX_FACTS);

  return deduplicateSentences([...prioritized, ...fallback]).slice(0, MAX_FACTS).map(createDraftItem);
}

function buildEmotions(sentences: string[]): StructuredTextItem[] {
  const matched = takeMatchingSentences(sentences, EMOTION_KEYWORDS, MAX_SECTION_ITEMS);

  if (matched.length === 0) {
    return [createDraftItem("未明确记录情绪")];
  }

  return matched.map(createDraftItem);
}

function buildSectionItems(
  sentences: string[],
  keywords: string[],
  transformDetail: (sentence: string) => string = identity,
): StructuredTextItem[] {
  return takeMatchingSentences(sentences, keywords, MAX_SECTION_ITEMS).map((sentence) =>
    createDraftItem(transformDetail(sentence)),
  );
}

function createDraftItem(detail: string): StructuredTextItem {
  return {
    title: LOCAL_DRAFT_TITLE,
    detail: truncateDetail(detail),
  };
}

function splitRawContentIntoSentences(rawContent: string): string[] {
  const normalized = rawContent
    .replace(/\r\n/g, "\n")
    .replace(/[•·●]/g, "\n")
    .split(/\n+/u)
    .flatMap((line) => line.split(/(?<=[。！？!?；;])/u))
    .map((line) => normalizeText(line))
    .filter((line) => line.length > 0);

  if (normalized.length > 0) {
    return deduplicateSentences(normalized);
  }

  return [truncateDetail(normalizeText(rawContent))].filter((line) => line.length > 0);
}

function takeMatchingSentences(sentences: string[], keywords: string[], limit: number): string[] {
  return sentences
    .filter((sentence) => containsAnyKeyword(sentence, keywords))
    .slice(0, limit);
}

function containsAnyKeyword(sentence: string, keywords: string[]): boolean {
  const lowered = sentence.toLowerCase();
  return keywords.some((keyword) => lowered.includes(keyword.toLowerCase()));
}

function extractNextActionDetail(sentence: string): string {
  return extractMatchingClause(sentence, NEXT_ACTION_KEYWORDS);
}

function extractDecisionImpactDetail(sentence: string): string {
  return extractMatchingClause(sentence, DECISION_IMPACT_KEYWORDS);
}

function extractMatchingClause(sentence: string, keywords: string[]): string {
  const clauses = sentence
    .split(/[，,]/u)
    .map((clause) => normalizeText(clause))
    .filter((clause) => clause.length > 0);

  const matchedClause = clauses.find((clause) => containsAnyKeyword(clause, keywords));
  return matchedClause ?? sentence;
}

function deduplicateSentences(sentences: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const sentence of sentences) {
    const key = normalizeText(sentence).toLowerCase();

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(sentence);
  }

  return unique;
}

function truncateDetail(value: string): string {
  if (value.length <= MAX_DETAIL_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_DETAIL_LENGTH - 1).trimEnd()}…`;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function identity<T>(value: T): T {
  return value;
}
