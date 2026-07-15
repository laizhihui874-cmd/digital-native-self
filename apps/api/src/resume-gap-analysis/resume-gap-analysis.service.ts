import type {
  CreateResumeGapAnalysisRequest,
  ResumeGapAnalysisResponse,
  ResumeGapItem,
  ResumeGapMatchedEvidence,
  ResumeGapRequirementItem,
} from "@digital-self/shared";
import { Inject, Injectable } from "@nestjs/common";

import { DefaultIdentityService } from "../identity/default-identity.service";
import {
  ResumeGapAnalysisRepository,
  type ResumeGapAnalysisSourceBundle,
} from "./resume-gap-analysis.repository";

const MAX_REQUIREMENTS = 12;
const MAX_MATCHES_PER_REQUIREMENT = 3;
const MIN_KEYWORD_LENGTH = 2;

const roleTemplateRequirements: Array<{ pattern: RegExp; items: string[] }> = [
  {
    pattern: /ai|人工智能|大模型|llm|应用开发|agent/i,
    items: [
      "具备 AI 应用开发、模型 API 接入或 Agent 工具链实践",
      "能完成需求拆解、接口联调、错误处理和基础自动化验证",
      "能将项目过程沉淀为可复用的项目经历与简历表达",
      "具备清晰沟通、跨角色协作和问题反馈能力",
    ],
  },
  {
    pattern: /运营|增长|销售|商务/i,
    items: [
      "具备用户需求理解、沟通表达和目标拆解能力",
      "能整理行业信息、竞品信息和转化路径证据",
      "有可量化的项目推进、复盘和结果沉淀",
    ],
  },
];

const defaultTemplateRequirements = [
  "能清楚描述目标岗位所需能力与个人经历的匹配关系",
  "有可追溯的项目经历、能力证据和结果产出",
  "能识别当前简历与目标岗位之间的关键缺口并制定行动计划",
];

type EvidenceDocument = {
  evidenceType: ResumeGapMatchedEvidence["evidenceType"];
  evidenceId: string;
  title?: string | null;
  content: string;
  searchableText: string;
};

@Injectable()
export class ResumeGapAnalysisService {
  constructor(
    @Inject(ResumeGapAnalysisRepository)
    private readonly resumeGapAnalysisRepository: ResumeGapAnalysisRepository,
    @Inject(DefaultIdentityService)
    private readonly identityService: DefaultIdentityService,
  ) {}

  async create(input: CreateResumeGapAnalysisRequest): Promise<ResumeGapAnalysisResponse> {
    const userId = await this.identityService.getCurrentUserId();
    const sources = await this.resumeGapAnalysisRepository.listSources(userId);
    const requirementItems = buildRequirementItems(input);
    const evidenceDocuments = buildEvidenceDocuments(sources);
    const matchedEvidence = buildMatchedEvidence(requirementItems, evidenceDocuments);
    const gapItems = buildGapItems(requirementItems, matchedEvidence);

    return {
      targetRole: input.targetRole.trim(),
      targetCompany: normalizeOptionalText(input.targetCompany) ?? null,
      summary: buildSummary(requirementItems, matchedEvidence, gapItems),
      analysisMode: "deterministic",
      requirementItems,
      matchedEvidence,
      gapItems,
      actionSuggestions: buildActionSuggestions(gapItems, matchedEvidence),
      sourceSnapshot: {
        resumeDocuments: sources.resumeDocuments.length,
        confirmedResumeMaterials: sources.confirmedResumeMaterials.length,
        projects: sources.projects.length,
        confirmedAbilityEvidence: sources.confirmedAbilityEvidence.length,
        externalSources: sources.externalSources.length,
      },
    };
  }
}

function buildRequirementItems(input: CreateResumeGapAnalysisRequest): ResumeGapRequirementItem[] {
  const jdItems = extractRequirementTextsFromJd(input.targetJobDescription);
  const source = jdItems.length > 0 ? "jd" : "role_template";
  const texts = jdItems.length > 0 ? jdItems : inferRoleTemplateRequirements(input.targetRole);

  return texts.slice(0, MAX_REQUIREMENTS).map((text, index) => ({
    id: `req-${index + 1}`,
    text,
    keywords: extractKeywords(text),
    source,
  }));
}

function extractRequirementTextsFromJd(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/\r?\n|[。；;]/)
    .map(stripListPrefix)
    .map((line) => line.trim())
    .filter((line) => line.length >= 4)
    .filter((line) => /要求|负责|熟悉|具备|经验|能力|掌握|优先|开发|搭建|沟通|协作|分析|测试/i.test(line));
}

function inferRoleTemplateRequirements(targetRole: string): string[] {
  const matchedTemplate = roleTemplateRequirements.find((template) =>
    template.pattern.test(targetRole),
  );

  return matchedTemplate?.items ?? defaultTemplateRequirements;
}

function buildEvidenceDocuments(sources: ResumeGapAnalysisSourceBundle): EvidenceDocument[] {
  return [
    ...sources.resumeDocuments.map((item) => ({
      evidenceType: "resume_document" as const,
      evidenceId: item.id,
      title: item.title,
      content: truncateText(item.content),
      searchableText: item.content,
    })),
    ...sources.confirmedResumeMaterials.map((item) => ({
      evidenceType: "resume_material" as const,
      evidenceId: item.id,
      title: item.materialType,
      content: item.suggestedBullet ?? item.content,
      searchableText: [item.content, item.suggestedBullet].filter(Boolean).join("\n"),
    })),
    ...sources.projects.map((item) => ({
      evidenceType: "project" as const,
      evidenceId: item.id,
      title: item.name,
      content: truncateText(
        [item.name, item.role, item.description, item.resumeSummary, ...item.outcomes]
          .filter(Boolean)
          .join("\n"),
      ),
      searchableText: [item.name, item.role, item.description, item.resumeSummary, ...item.outcomes]
        .filter(Boolean)
        .join("\n"),
    })),
    ...sources.confirmedAbilityEvidence.map((item) => ({
      evidenceType: "ability_evidence" as const,
      evidenceId: item.id,
      title: item.abilityNode.name,
      content: item.content,
      searchableText: `${item.abilityNode.name}\n${item.content}`,
    })),
    ...sources.externalSources.map((item) => ({
      evidenceType: "external_source" as const,
      evidenceId: item.id,
      title: `${item.sourceSite}: ${item.title}`,
      content: truncateText([item.summary, item.relationToDecision].filter(Boolean).join("\n")),
      searchableText: [item.title, item.sourceSite, item.summary, item.relationToDecision]
        .filter(Boolean)
        .join("\n"),
    })),
  ];
}

function buildMatchedEvidence(
  requirementItems: ResumeGapRequirementItem[],
  evidenceDocuments: EvidenceDocument[],
): ResumeGapMatchedEvidence[] {
  return requirementItems.flatMap((requirement) => {
    const matches = evidenceDocuments
      .map((document) => ({
        document,
        matchedKeywords: requirement.keywords.filter((keyword) =>
          includesNormalized(document.searchableText, keyword),
        ),
      }))
      .filter((item) => item.matchedKeywords.length > 0)
      .sort((left, right) => right.matchedKeywords.length - left.matchedKeywords.length)
      .slice(0, MAX_MATCHES_PER_REQUIREMENT);

    return matches.map((match) => ({
      requirementId: requirement.id,
      requirementText: requirement.text,
      evidenceType: match.document.evidenceType,
      evidenceId: match.document.evidenceId,
      title: match.document.title,
      content: match.document.content,
      matchedKeywords: match.matchedKeywords,
    }));
  });
}

function buildGapItems(
  requirementItems: ResumeGapRequirementItem[],
  matchedEvidence: ResumeGapMatchedEvidence[],
): ResumeGapItem[] {
  return requirementItems.flatMap((requirement) => {
    const matches = matchedEvidence.filter((item) => item.requirementId === requirement.id);
    const matchedKeywords = new Set(matches.flatMap((item) => item.matchedKeywords));
    const missingKeywords = requirement.keywords.filter((keyword) => !matchedKeywords.has(keyword));

    if (matches.length > 0 && missingKeywords.length <= Math.max(1, requirement.keywords.length - 2)) {
      return [];
    }

    return [
      {
        requirementId: requirement.id,
        requirementText: requirement.text,
        severity: resolveSeverity(matches.length, missingKeywords.length),
        reason:
          matches.length === 0
            ? "当前已确认资料中没有找到直接匹配证据。"
            : "当前有部分证据，但仍缺少更完整或更直接的关键词与成果支撑。",
        missingKeywords,
      },
    ];
  });
}

function resolveSeverity(matchCount: number, missingCount: number): ResumeGapItem["severity"] {
  if (matchCount === 0) {
    return "high";
  }

  if (missingCount >= 3) {
    return "medium";
  }

  return "low";
}

function buildSummary(
  requirementItems: ResumeGapRequirementItem[],
  matchedEvidence: ResumeGapMatchedEvidence[],
  gapItems: ResumeGapItem[],
): string {
  const matchedRequirementCount = new Set(matchedEvidence.map((item) => item.requirementId)).size;

  return `基于当前已确认资料的初步差距分析：共识别 ${requirementItems.length} 条岗位要求，其中 ${matchedRequirementCount} 条已有可追溯证据，${gapItems.length} 条仍需要补充。该结论由规则匹配生成，不等同于真实招聘方评价。`;
}

function buildActionSuggestions(
  gapItems: ResumeGapItem[],
  matchedEvidence: ResumeGapMatchedEvidence[],
): string[] {
  const suggestions = [
    "先把已匹配证据整理成 2-3 条可量化简历 bullet，避免只停留在经历描述。",
  ];

  if (gapItems.length > 0) {
    suggestions.push(
      `优先补齐高严重度缺口：${gapItems
        .filter((item) => item.severity === "high")
        .slice(0, 2)
        .map((item) => item.requirementText)
        .join("；") || gapItems[0].requirementText}`,
    );
  }

  if (matchedEvidence.length === 0) {
    suggestions.push("当前缺少可直接匹配目标岗位的确认素材，建议先确认能力证据和候选简历素材。");
  } else {
    suggestions.push("把匹配证据回填到项目经历页，明确项目背景、你的动作、结果和可验证产出。");
  }

  return suggestions;
}

function extractKeywords(value: string): string[] {
  const normalized = normalizeText(value);
  const asciiWords = normalized.match(/[a-z0-9][a-z0-9+#.-]{1,}/gi) ?? [];
  const chineseChunks = normalized
    .split(/[，,、\s/|（）()：:；;。.!！?？-]+/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => /[\u4e00-\u9fa5]/.test(chunk))
    .flatMap(splitChineseChunk);

  return [...new Set([...asciiWords, ...chineseChunks].map(normalizeText))]
    .filter((keyword) => keyword.length >= MIN_KEYWORD_LENGTH)
    .filter((keyword) => !isStopKeyword(keyword))
    .slice(0, 8);
}

function splitChineseChunk(value: string): string[] {
  const cleaned = value.replace(/^(负责|具备|熟悉|掌握|要求|优先|能够|能|有|需要)/, "");
  const segments = cleaned.split(/和|及|与|或|并|、/).filter(Boolean);

  return [cleaned, ...segments].map((segment) => segment.trim());
}

function isStopKeyword(value: string): boolean {
  return [
    "岗位要求",
    "任职要求",
    "工作职责",
    "相关经验",
    "能力",
    "经验",
    "负责",
    "具备",
    "熟悉",
    "优先",
  ].includes(value);
}

function stripListPrefix(value: string): string {
  return value.replace(/^\s*(?:[-*•]\s+|\d+[.)、]\s*)/, "");
}

function includesNormalized(text: string, keyword: string): boolean {
  return normalizeText(text).includes(normalizeText(keyword));
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function truncateText(value: string): string {
  const normalized = value.trim();
  return normalized.length > 260 ? `${normalized.slice(0, 260)}...` : normalized;
}
