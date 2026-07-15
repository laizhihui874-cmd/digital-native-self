import type {
  CreateExternalSourceImpactDraftRequest,
  ExternalSourceImpactDraftItem,
  ExternalSourceImpactDraftResponse,
  CreateExternalSourceRequest,
  DecisionEvidenceType,
  ExternalSourceSearchCategory,
  ExternalSource,
  ListExternalSourcesQuery,
  ListExternalSourcesResponse,
  SearchExternalSourcesRequest,
  SearchExternalSourcesResponse,
  UpdateExternalSourceRequest,
} from "@digital-self/shared";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { DefaultIdentityService } from "../identity/default-identity.service";
import { LifeDecisionsRepository } from "../life-decisions/life-decisions.repository";
import { ExternalSourceSearchProvider } from "./external-source-search.provider";
import { ExternalSourcesRepository } from "./external-sources.repository";

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;
const DEFAULT_SEARCH_LIMIT = 5;
const DEFAULT_SEARCH_CATEGORY: ExternalSourceSearchCategory = "other";
const DEFAULT_IMPACT_DRAFT_LIMIT = 8;

@Injectable()
export class ExternalSourcesService {
  constructor(
    @Inject(ExternalSourcesRepository)
    private readonly externalSourcesRepository: ExternalSourcesRepository,
    @Inject(DefaultIdentityService)
    private readonly identityService: DefaultIdentityService,
    @Inject(ExternalSourceSearchProvider)
    private readonly externalSourceSearchProvider: ExternalSourceSearchProvider,
    @Inject(LifeDecisionsRepository)
    private readonly lifeDecisionsRepository: LifeDecisionsRepository,
  ) {}

  async create(input: CreateExternalSourceRequest): Promise<ExternalSource> {
    const userId = await this.identityService.getCurrentUserId();

    if (input.lifeDecisionId) {
      await this.assertLifeDecisionExists(userId, input.lifeDecisionId);
    }

    return this.externalSourcesRepository.create(userId, input);
  }

  async list(query: ListExternalSourcesQuery): Promise<ListExternalSourcesResponse> {
    const userId = await this.identityService.getCurrentUserId();

    return this.externalSourcesRepository.list({
      userId,
      lifeDecisionId: query.lifeDecisionId,
      limit: query.limit ?? DEFAULT_LIMIT,
      offset: query.offset ?? DEFAULT_OFFSET,
    });
  }

  async search(input: SearchExternalSourcesRequest): Promise<SearchExternalSourcesResponse> {
    const userId = await this.identityService.getCurrentUserId();
    const lifeDecisionId = input.lifeDecisionId;

    if (lifeDecisionId) {
      await this.assertLifeDecisionExists(userId, lifeDecisionId);
    }

    const category = input.category ?? DEFAULT_SEARCH_CATEGORY;
    const limit = input.limit ?? DEFAULT_SEARCH_LIMIT;
    const searchedAt = new Date();
    const providerResult = await this.externalSourceSearchProvider.search({
      query: input.query.trim(),
      category,
      limit,
    });

    const savedItems: ExternalSource[] = [];

    for (const item of providerResult.items.slice(0, limit)) {
      savedItems.push(
        await this.externalSourcesRepository.create(userId, {
          lifeDecisionId,
          title: item.title,
          sourceSite: item.sourceSite,
          url: item.url,
          publishedAt: item.publishedAt ?? undefined,
          summary: item.summary ?? undefined,
          relationToDecision: item.relationToDecision ?? buildDefaultRelation(category),
        }),
      );
    }

    return {
      query: input.query.trim(),
      category,
      searchMode: providerResult.searchMode,
      summary: buildSearchSummary({
        query: input.query.trim(),
        searchMode: providerResult.searchMode,
        returnedResults: providerResult.items.length,
        savedResults: savedItems.length,
      }),
      items: providerResult.items,
      savedItems,
      sourceSnapshot: {
        searchedAt: searchedAt.toISOString(),
        provider: providerResult.provider,
        requestedLimit: limit,
        returnedResults: providerResult.items.length,
        savedResults: savedItems.length,
        lifeDecisionId: lifeDecisionId ?? null,
      },
    };
  }

  async findById(id: string): Promise<ExternalSource> {
    const userId = await this.identityService.getCurrentUserId();
    const externalSource = await this.externalSourcesRepository.findById(userId, id);

    if (!externalSource) {
      throw new NotFoundException(`ExternalSource ${id} was not found.`);
    }

    return externalSource;
  }

  async createImpactDraft(
    input: CreateExternalSourceImpactDraftRequest,
  ): Promise<ExternalSourceImpactDraftResponse> {
    const userId = await this.identityService.getCurrentUserId();
    const decision = await this.lifeDecisionsRepository.findDecisionById(
      userId,
      input.lifeDecisionId,
    );

    if (!decision) {
      throw new NotFoundException(`LifeDecision ${input.lifeDecisionId} was not found.`);
    }

    const selectedSourceIds = input.externalSourceIds ?? [];
    const selectedSourceIdSet = new Set(selectedSourceIds);

    if (selectedSourceIds.length !== selectedSourceIdSet.size) {
      throw new BadRequestException(
        "externalSourceIds must not contain duplicate ExternalSource ids.",
      );
    }

    const sources =
      selectedSourceIds.length > 0
        ? decision.externalSources.filter((source) => selectedSourceIdSet.has(source.id))
        : decision.externalSources;

    if (selectedSourceIds.length > 0 && sources.length !== selectedSourceIdSet.size) {
      throw new NotFoundException(
        "One or more ExternalSource ids were not found under the requested LifeDecision.",
      );
    }

    const warnings: string[] = [
      "analysisMode=deterministic；本接口只生成候选影响草稿，不会自动写入 DecisionEvidence。",
      "外部来源摘要可能来自 best-effort 搜索或人工登记，重要结论必须打开 URL 核对。",
    ];

    if (decision.paths.length === 0) {
      warnings.push("当前 LifeDecision 没有候选路径，无法生成路径级影响草稿。");
    }

    if (sources.length === 0) {
      warnings.push("当前 LifeDecision 没有关联外部来源，无法生成影响草稿。");
    }

    const maxItems = input.maxItems ?? DEFAULT_IMPACT_DRAFT_LIMIT;
    const items = sources
      .flatMap((source) => buildImpactDraftItems(source, decision.paths))
      .slice(0, maxItems);

    return {
      analysisMode: "deterministic",
      lifeDecisionId: decision.id,
      generatedAt: new Date().toISOString(),
      items,
      warnings,
      sourceSnapshot: {
        externalSourcesRead: sources.length,
        pathsRead: decision.paths.length,
        selectedSourceIds: sources.map((source) => source.id),
      },
    };
  }

  async update(id: string, input: UpdateExternalSourceRequest): Promise<ExternalSource> {
    const userId = await this.identityService.getCurrentUserId();

    if (typeof input.lifeDecisionId === "string" && input.lifeDecisionId.length > 0) {
      await this.assertLifeDecisionExists(userId, input.lifeDecisionId);
    }

    const externalSource = await this.externalSourcesRepository.update(userId, id, input);

    if (!externalSource) {
      throw new NotFoundException(`ExternalSource ${id} was not found.`);
    }

    return externalSource;
  }

  async delete(id: string): Promise<void> {
    const userId = await this.identityService.getCurrentUserId();
    const deleted = await this.externalSourcesRepository.delete(userId, id);

    if (!deleted) {
      throw new NotFoundException(`ExternalSource ${id} was not found.`);
    }
  }

  private async assertLifeDecisionExists(userId: string, lifeDecisionId: string): Promise<void> {
    const existingId = await this.externalSourcesRepository.findOwnedLifeDecisionId(
      userId,
      lifeDecisionId,
    );

    if (!existingId) {
      throw new NotFoundException(`LifeDecision ${lifeDecisionId} was not found.`);
    }
  }
}

type PathLike = {
  id: string;
  title: string;
  description?: string | null;
  benefits: string[];
  risks: string[];
};

function buildImpactDraftItems(
  source: ExternalSource,
  paths: PathLike[],
): ExternalSourceImpactDraftItem[] {
  if (paths.length === 0) {
    return [];
  }

  const rankedPaths = paths
    .map((path) => ({
      path,
      score: scoreSourceAgainstPath(source, path),
    }))
    .sort((left, right) => right.score - left.score);

  const selectedPath = rankedPaths[0]?.path;

  if (!selectedPath) {
    return [];
  }

  const evidenceType = inferEvidenceType(source, selectedPath);
  const suggestedWeight = evidenceType === "neutral" ? 0.35 : 0.55;

  return [
    {
      externalSourceId: source.id,
      externalSourceTitle: source.title,
      sourceSite: source.sourceSite,
      url: source.url,
      pathId: selectedPath.id,
      pathTitle: selectedPath.title,
      evidenceType,
      suggestedWeight,
      suggestedContent: buildSuggestedEvidenceContent(source, selectedPath, evidenceType),
      rationale: buildRationale(source, selectedPath, evidenceType),
      confirmationRequired: true,
    },
  ];
}

function scoreSourceAgainstPath(source: ExternalSource, path: PathLike): number {
  const sourceText = normalizeSearchableText([
    source.title,
    source.sourceSite,
    source.summary,
    source.relationToDecision,
  ]);
  const pathText = normalizeSearchableText([
    path.title,
    path.description,
    ...path.benefits,
    ...path.risks,
  ]);
  const directTokens = extractTokens(pathText).filter((token) => sourceText.includes(token));

  return directTokens.length + scoreScenarioMatch(sourceText, pathText);
}

function scoreScenarioMatch(sourceText: string, pathText: string): number {
  let score = 0;

  if (containsAny(pathText, ["考研", "升学", "哲学", "学校"]) && containsAny(sourceText, ["考研", "招生", "哲学", "学校", "华南"])) {
    score += 3;
  }

  if (containsAny(pathText, ["工作", "换工作", "实习", "公司"]) && containsAny(sourceText, ["岗位", "招聘", "薪资", "jd", "工程师", "就业"])) {
    score += 3;
  }

  if (containsAny(pathText, ["ai", "技术", "开发"]) && containsAny(sourceText, ["ai", "应用", "技术", "开发", "agent"])) {
    score += 2;
  }

  return score;
}

function inferEvidenceType(source: ExternalSource, path: PathLike): DecisionEvidenceType {
  const text = normalizeSearchableText([
    source.title,
    source.summary,
    source.relationToDecision,
    path.title,
    path.description,
  ]);

  const supportScore = countKeywordHits(text, [
    "支持",
    "机会",
    "成长",
    "匹配",
    "需求",
    "岗位",
    "培养",
    "项目",
    "招生",
  ]);
  const againstScore = countKeywordHits(text, [
    "不支持",
    "风险",
    "压力",
    "消耗",
    "门槛高",
    "竞争",
    "下降",
    "不匹配",
  ]);

  if (supportScore > againstScore) {
    return "support";
  }

  if (againstScore > supportScore) {
    return "against";
  }

  return "neutral";
}

function buildSuggestedEvidenceContent(
  source: ExternalSource,
  path: PathLike,
  evidenceType: DecisionEvidenceType,
): string {
  const summary = source.summary?.trim() || source.relationToDecision?.trim() || "该来源暂无摘要，需要打开原链接核对。";
  return [
    `候选外部信息证据（待用户确认）：${source.title}`,
    `关联路径：${path.title}`,
    `初步方向：${evidenceType}`,
    `来源摘要：${summary}`,
    `来源链接：${source.url}`,
  ].join("\n");
}

function buildRationale(
  source: ExternalSource,
  path: PathLike,
  evidenceType: DecisionEvidenceType,
): string {
  return `系统根据来源标题 / 摘要与路径「${path.title}」的关键词重合，生成 ${evidenceType} 候选判断；该判断只用于草稿，确认后才可写入正式决策证据。`;
}

function normalizeSearchableText(values: Array<string | null | undefined>): string {
  return values.filter((value): value is string => typeof value === "string").join(" ").toLowerCase();
}

function extractTokens(text: string): string[] {
  return Array.from(new Set(text.split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2)));
}

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function countKeywordHits(text: string, keywords: string[]): number {
  return keywords.reduce(
    (count, keyword) => count + (text.includes(keyword.toLowerCase()) ? 1 : 0),
    0,
  );
}

function buildDefaultRelation(category: ExternalSourceSearchCategory): string {
  const categoryLabelMap: Record<ExternalSourceSearchCategory, string> = {
    ai_role: "用于理解 AI 应用开发岗位要求，需用户打开来源自行核对。",
    job_market: "用于观察岗位行情与地域机会，需用户打开来源自行核对。",
    industry: "用于观察行业趋势与就业前景，需用户打开来源自行核对。",
    postgraduate: "用于了解考研与学校信息，需用户打开来源自行核对。",
    other: "用于补充当前人生节点的外部信息，需用户打开来源自行核对。",
  };

  return categoryLabelMap[category];
}

function buildSearchSummary(params: {
  query: string;
  searchMode: "fake" | "best_effort_web";
  returnedResults: number;
  savedResults: number;
}): string {
  const modeText =
    params.searchMode === "fake"
      ? "fake provider 本地验收"
      : "best-effort web search";

  return `已使用 ${modeText} 搜索「${params.query}」，返回 ${params.returnedResults} 条结果并保存 ${params.savedResults} 条 ExternalSource。摘要来自标题 / snippet 的 deterministic 整理，不代表模型深度研究或权威结论。`;
}
