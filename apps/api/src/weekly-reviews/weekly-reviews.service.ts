import type {
  GetLatestWeeklyReviewQuery,
  GetWeeklyReviewByPeriodQuery,
  MetricRatingValue,
  StructuredTextItem,
  WeeklyReviewDetail,
  WeeklyReviewGenerateRequest,
  WeeklyReviewGenerateResponse,
} from "@digital-self/shared";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { DefaultIdentityService } from "../identity/default-identity.service";
import {
  type WeeklyReviewGenerationSource,
  WeeklyReviewsRepository,
} from "./weekly-reviews.repository";

type GenerationDraft = {
  progressSummary: string;
  abilityChanges: StructuredTextItem[];
  emotionPatterns: StructuredTextItem[];
  goalDrift: string;
  nextWeekSuggestions: StructuredTextItem[];
  lifePossibilityNotes: string;
  emotionPattern: {
    dominantEmotions: string[];
    triggers: string[];
    patterns: StructuredTextItem[];
    decisionRisk: string;
  };
};

const MAX_DETAIL_ITEMS = 4;
const MAX_EMOTION_ITEMS = 3;

@Injectable()
export class WeeklyReviewsService {
  constructor(
    @Inject(WeeklyReviewsRepository)
    private readonly weeklyReviewsRepository: WeeklyReviewsRepository,
    @Inject(DefaultIdentityService)
    private readonly identityService: DefaultIdentityService,
  ) {}

  async generate(input: WeeklyReviewGenerateRequest): Promise<WeeklyReviewGenerateResponse> {
    validatePeriodRange(input.periodStart, input.periodEnd);

    const userId = await this.identityService.getCurrentUserId();
    const lifeDecisionId = await this.validateLifeDecisionOwnership(userId, input.lifeDecisionId);
    const source = await this.weeklyReviewsRepository.collectGenerationSource(
      userId,
      input.periodStart,
      input.periodEnd,
      lifeDecisionId ?? undefined,
    );
    const draft = buildDeterministicDraft(source);
    const weeklyReview = await this.weeklyReviewsRepository.upsertGeneratedReview(userId, {
      lifeDecisionId: lifeDecisionId ?? undefined,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      ...draft,
    });

    return {
      weeklyReview,
      generationMode: "deterministic",
      sourceSnapshot: {
        dailyEntriesRead: source.dailyEntries.length,
        structuredReportsRead: source.dailyEntries.filter((entry) => entry.structuredReport).length,
        metricRatingsRead: source.dailyEntries.reduce((count, entry) => count + entry.metricRatings.length, 0),
        confirmedMemoriesRead: source.confirmedMemories.length,
        decisionEvidenceRead: source.decisionEvidence.length,
      },
    };
  }

  async findLatest(query: GetLatestWeeklyReviewQuery): Promise<WeeklyReviewDetail | null> {
    const userId = await this.identityService.getCurrentUserId();
    const lifeDecisionId = await this.validateLifeDecisionOwnership(userId, query.lifeDecisionId);

    return this.weeklyReviewsRepository.findLatest(userId, lifeDecisionId ?? undefined);
  }

  async findByPeriod(query: GetWeeklyReviewByPeriodQuery): Promise<WeeklyReviewDetail | null> {
    validatePeriodRange(query.periodStart, query.periodEnd);

    const userId = await this.identityService.getCurrentUserId();
    const lifeDecisionId = await this.validateLifeDecisionOwnership(userId, query.lifeDecisionId);

    return this.weeklyReviewsRepository.findByPeriod(
      userId,
      query.periodStart,
      query.periodEnd,
      lifeDecisionId ?? undefined,
    );
  }

  private async validateLifeDecisionOwnership(
    userId: string,
    lifeDecisionId?: string,
  ): Promise<string | null> {
    if (!lifeDecisionId) {
      return null;
    }

    const ownedId = await this.weeklyReviewsRepository.findOwnedLifeDecisionId(userId, lifeDecisionId);

    if (!ownedId) {
      throw new NotFoundException(`LifeDecision ${lifeDecisionId} was not found.`);
    }

    return ownedId;
  }
}

function buildDeterministicDraft(source: WeeklyReviewGenerationSource): GenerationDraft {
  const structuredReports = source.dailyEntries
    .map((entry) => entry.structuredReport)
    .filter((report): report is NonNullable<typeof report> => Boolean(report));
  const allFacts = structuredReports.flatMap((report) => report.facts);
  const allEmotions = structuredReports.flatMap((report) => report.emotions);
  const allWorkItems = structuredReports.flatMap((report) => report.workItems);
  const allGrowthEvidence = structuredReports.flatMap((report) => report.growthEvidence);
  const allDrainSources = structuredReports.flatMap((report) => report.drainSources);
  const allNextActions = structuredReports.flatMap((report) => report.nextActions);
  const allDecisionImpact = structuredReports.flatMap((report) => report.decisionImpact);
  const metricRatings = source.dailyEntries.flatMap((entry) => entry.metricRatings);
  const metricsByType = summarizeMetrics(metricRatings);
  const supportEvidence = source.decisionEvidence.filter((item) => item.evidenceType === "support");
  const againstEvidence = source.decisionEvidence.filter((item) => item.evidenceType === "against");

  const progressSummaryParts = [
    `本周读取了 ${source.dailyEntries.length} 条日记、${structuredReports.length} 份结构化日报和 ${source.confirmedMemories.length} 条已确认记忆。`,
    summarizeItemGroup("关键事实", allFacts),
    summarizeItemGroup("推进事项", allWorkItems),
    summarizeMetricSentence(metricsByType),
  ].filter((part) => part.length > 0);

  const abilityChanges = takeStructuredItems(allGrowthEvidence, MAX_DETAIL_ITEMS, "能力增长") ?? [
    {
      title: "能力增长",
      detail: structuredReports.length > 0 ? "本周未沉淀出明确的增长证据，建议下周继续记录可复用的方法和成果。" : "本周暂无日报数据，暂时无法归纳能力变化。",
    },
  ];

  const emotionPatterns = takeStructuredItems(allDrainSources, MAX_DETAIL_ITEMS, "情绪模式") ?? [
    {
      title: "情绪模式",
      detail: source.dailyEntries.length > 0 ? "本周未记录明显的消耗源，建议继续观察触发情绪波动的场景。" : "本周暂无情绪数据，建议先补充每日情绪与压力记录。",
    },
  ];

  const nextWeekSuggestions = buildNextWeekSuggestions({
    nextActions: allNextActions,
    drainSources: allDrainSources,
    metricsByType,
    decisionEvidence: source.decisionEvidence,
  });

  const dominantEmotions = pickDistinctLabels(allEmotions, MAX_EMOTION_ITEMS, "平稳");
  const triggers = pickDistinctLabels(
    [...allDrainSources, ...allWorkItems, ...allDecisionImpact],
    MAX_EMOTION_ITEMS,
    source.dailyEntries.length > 0 ? "事务切换" : "暂无触发器",
  );

  const patterns = takeStructuredItems(allEmotions, MAX_DETAIL_ITEMS, "情绪观察") ?? [
    {
      title: "情绪观察",
      detail: source.dailyEntries.length > 0 ? "本周情绪标签不足，建议在日报中补充更具体的情绪名称和触发背景。" : "本周暂无日报内容，暂时没有可供总结的情绪模式。",
    },
  ];

  return {
    progressSummary: progressSummaryParts.join(" "),
    abilityChanges,
    emotionPatterns,
    goalDrift: buildGoalDrift({
      metricsByType,
      nextActions: allNextActions,
      decisionImpact: allDecisionImpact,
      dailyEntryCount: source.dailyEntries.length,
    }),
    nextWeekSuggestions,
    lifePossibilityNotes: buildLifePossibilityNotes({
      confirmedMemories: source.confirmedMemories,
      decisionImpact: allDecisionImpact,
      decisionEvidence: source.decisionEvidence,
      supportEvidenceCount: supportEvidence.length,
      againstEvidenceCount: againstEvidence.length,
    }),
    emotionPattern: {
      dominantEmotions,
      triggers,
      patterns,
      decisionRisk: buildDecisionRisk(metricsByType, supportEvidence.length, againstEvidence.length),
    },
  };
}

function buildNextWeekSuggestions(input: {
  nextActions: StructuredTextItem[];
  drainSources: StructuredTextItem[];
  metricsByType: Map<string, number[]>;
  decisionEvidence: WeeklyReviewGenerationSource["decisionEvidence"];
}): StructuredTextItem[] {
  const fromActions = takeStructuredItems(input.nextActions, 2, "下周行动") ?? [];
  const suggestions = [...fromActions];

  const drainLabel = firstDistinctLabel(input.drainSources);
  if (drainLabel) {
    suggestions.push({
      title: "减轻消耗",
      detail: `优先处理与“${drainLabel}”相关的阻力，避免重复进入高消耗场景。`,
    });
  }

  const communicationPressureAverage = averageScore(input.metricsByType.get("communication_pressure"));
  if (communicationPressureAverage !== null && communicationPressureAverage <= 2.5) {
    suggestions.push({
      title: "沟通减压",
      detail: "沟通压力评分偏低，建议提前准备关键信息并缩短高噪音同步。 ",
    });
  }

  if (input.decisionEvidence.length > 0) {
    suggestions.push({
      title: "推进决策验证",
      detail: `下周可以围绕 ${input.decisionEvidence[0].pathTitle} 继续补充可验证证据，减少判断悬空。`,
    });
  }

  if (suggestions.length === 0) {
    return [
      {
        title: "下周行动",
        detail: "本周暂无明确行动项，建议先为下周设定 1-2 个可交付的小目标。",
      },
    ];
  }

  return suggestions.slice(0, MAX_DETAIL_ITEMS);
}

function buildGoalDrift(input: {
  metricsByType: Map<string, number[]>;
  nextActions: StructuredTextItem[];
  decisionImpact: StructuredTextItem[];
  dailyEntryCount: number;
}): string {
  if (input.dailyEntryCount === 0) {
    return "本周暂无数据，无法判断目标是否漂移，建议先恢复基础记录。";
  }

  const longTermFitAverage = averageScore(input.metricsByType.get("long_term_fit"));
  const nextActionLabel = firstDistinctLabel(input.nextActions);
  const decisionImpactLabel = firstDistinctLabel(input.decisionImpact);

  if (longTermFitAverage !== null && longTermFitAverage <= 2.5) {
    return `长期匹配度偏低，说明本周的投入可能正在偏离长期目标。优先复核${nextActionLabel ? `“${nextActionLabel}”` : "下周行动"}是否仍然服务核心方向。`;
  }

  if (decisionImpactLabel) {
    return `本周的关键选择主要围绕“${decisionImpactLabel}”展开，当前行动仍与既定方向一致，但需要继续检验实际影响。`;
  }

  return "本周行动与当前目标大体一致，暂未观察到明显的目标漂移。";
}

function buildLifePossibilityNotes(input: {
  confirmedMemories: WeeklyReviewGenerationSource["confirmedMemories"];
  decisionImpact: StructuredTextItem[];
  decisionEvidence: WeeklyReviewGenerationSource["decisionEvidence"];
  supportEvidenceCount: number;
  againstEvidenceCount: number;
}): string {
  const memorySummary = input.confirmedMemories
    .slice(0, 2)
    .map((memory) => memory.content.trim())
    .filter((content) => content.length > 0);
  const decisionImpactLabel = firstDistinctLabel(input.decisionImpact);

  if (memorySummary.length === 0 && input.decisionEvidence.length === 0) {
    return "本周还没有足够的记忆或决策证据，人生可能性判断仍需继续积累样本。";
  }

  return [
    decisionImpactLabel ? `“${decisionImpactLabel}”是本周影响人生选项感知的核心主题。` : "",
    memorySummary.length > 0 ? `已确认记忆显示：${memorySummary.join("；")}。` : "",
    input.decisionEvidence.length > 0
      ? `当前决策证据中支持 ${input.supportEvidenceCount} 条、反对 ${input.againstEvidenceCount} 条，说明选择空间正在逐步收敛。`
      : "",
  ]
    .filter((part) => part.length > 0)
    .join(" ");
}

function buildDecisionRisk(
  metricsByType: Map<string, number[]>,
  supportEvidenceCount: number,
  againstEvidenceCount: number,
): string {
  const emotionalDrainAverage = averageScore(metricsByType.get("emotional_drain"));
  const communicationPressureAverage = averageScore(metricsByType.get("communication_pressure"));

  if (againstEvidenceCount > supportEvidenceCount) {
    return "反对证据多于支持证据，当前决策风险偏高，建议优先补充反例验证。";
  }

  if (
    (emotionalDrainAverage !== null && emotionalDrainAverage <= 2.5) ||
    (communicationPressureAverage !== null && communicationPressureAverage <= 2.5)
  ) {
    return "情绪消耗或沟通压力偏高，决策时需要警惕短期压力放大判断偏差。";
  }

  if (supportEvidenceCount === 0 && againstEvidenceCount === 0) {
    return "本周暂无决策证据，风险主要来自信息不足。";
  }

  return "当前决策风险可控，后续重点是继续补齐可验证证据而不是扩大猜测。";
}

function summarizeMetrics(
  metricRatings: Array<Pick<MetricRatingValue, "metricType" | "aiScore" | "userScore" | "finalScore">>,
): Map<string, number[]> {
  const metricsByType = new Map<string, number[]>();

  for (const rating of metricRatings) {
    const score = rating.finalScore ?? rating.userScore ?? rating.aiScore;

    if (typeof score !== "number") {
      continue;
    }

    const scores = metricsByType.get(rating.metricType) ?? [];
    scores.push(score);
    metricsByType.set(rating.metricType, scores);
  }

  return metricsByType;
}

function summarizeMetricSentence(metricsByType: Map<string, number[]>): string {
  const parts: string[] = [];

  for (const [metricType, scores] of metricsByType.entries()) {
    const average = averageScore(scores);

    if (average === null) {
      continue;
    }

    parts.push(`${metricType} 平均 ${average.toFixed(1)}`);
  }

  return parts.length > 0 ? `指标概览：${parts.join("，")}。` : "";
}

function summarizeItemGroup(label: string, items: StructuredTextItem[]): string {
  const labels = pickDistinctLabels(items, 2, "");

  if (labels.length === 0) {
    return "";
  }

  return `${label}集中在 ${labels.join("、")}。`;
}

function takeStructuredItems(
  items: StructuredTextItem[],
  limit: number,
  fallbackTitle: string,
): StructuredTextItem[] | null {
  const seen = new Set<string>();
  const picked: StructuredTextItem[] = [];

  for (const item of items) {
    const detail = item.detail.trim();

    if (detail.length === 0 || seen.has(detail)) {
      continue;
    }

    seen.add(detail);
    picked.push({
      title: item.title?.trim() || fallbackTitle,
      detail,
      citationIds: item.citationIds,
    });

    if (picked.length >= limit) {
      break;
    }
  }

  return picked.length > 0 ? picked : null;
}

function pickDistinctLabels(items: StructuredTextItem[], limit: number, fallback: string): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const candidate = item.title?.trim() || extractLeadingLabel(item.detail);

    if (candidate.length === 0 || seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);
    labels.push(candidate);

    if (labels.length >= limit) {
      break;
    }
  }

  if (labels.length === 0 && fallback.length > 0) {
    return [fallback];
  }

  return labels;
}

function firstDistinctLabel(items: StructuredTextItem[]): string | null {
  const labels = pickDistinctLabels(items, 1, "");
  return labels[0] ?? null;
}

function extractLeadingLabel(detail: string): string {
  const normalized = detail.trim().replace(/\s+/g, " ");

  if (normalized.length === 0) {
    return "";
  }

  const segment = normalized.split(/[，。；:：]/, 1)[0] ?? normalized;
  return segment.slice(0, 24).trim();
}

function averageScore(scores: number[] | undefined): number | null {
  if (!scores || scores.length === 0) {
    return null;
  }

  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function validatePeriodRange(periodStart: string, periodEnd: string): void {
  if (new Date(periodStart).getTime() > new Date(periodEnd).getTime()) {
    throw new BadRequestException("periodStart must be earlier than or equal to periodEnd.");
  }
}
