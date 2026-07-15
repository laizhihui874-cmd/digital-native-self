import type {
  CreateProjectPackagingSuggestionsRequest,
  ProjectPackagingSuggestionEvidenceItem,
  ProjectPackagingSuggestionItem,
  ProjectPackagingSuggestionsResponse,
} from "@digital-self/shared";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { DefaultIdentityService } from "../identity/default-identity.service";
import {
  ProjectPackagingSuggestionsRepository,
  type ProjectPackagingSuggestionSourceBundle,
} from "./project-packaging-suggestions.repository";

const MAX_MATERIAL_EVIDENCE = 3;
const MAX_ABILITY_EVIDENCE = 3;

type ProjectSource = ProjectPackagingSuggestionSourceBundle["availableProjects"][number];
type MaterialSource = ProjectPackagingSuggestionSourceBundle["confirmedResumeMaterials"][number];
type AbilitySource = ProjectPackagingSuggestionSourceBundle["confirmedAbilityEvidence"][number];

@Injectable()
export class ProjectPackagingSuggestionsService {
  constructor(
    @Inject(ProjectPackagingSuggestionsRepository)
    private readonly projectPackagingSuggestionsRepository: ProjectPackagingSuggestionsRepository,
    @Inject(DefaultIdentityService)
    private readonly identityService: DefaultIdentityService,
  ) {}

  async create(
    input: CreateProjectPackagingSuggestionsRequest,
  ): Promise<ProjectPackagingSuggestionsResponse> {
    const userId = await this.identityService.getCurrentUserId();
    const sources = await this.projectPackagingSuggestionsRepository.listSources(userId);
    const selectedProject = selectProject(sources.availableProjects, input.projectId);

    if (input.projectId && !selectedProject) {
      throw new NotFoundException(`Project ${input.projectId} was not found.`);
    }

    const materialEvidence = selectRelevantMaterials(sources.confirmedResumeMaterials, selectedProject);
    const abilityEvidence = selectRelevantAbilityEvidence(
      sources.confirmedAbilityEvidence,
      selectedProject,
      materialEvidence,
    );
    const suggestionItems = buildSuggestionItems({
      input,
      selectedProject,
      materialEvidence,
      abilityEvidence,
    });

    return {
      targetRole: input.targetRole.trim(),
      targetCompany: normalizeOptionalText(input.targetCompany) ?? null,
      targetJobDescription: normalizeOptionalText(input.targetJobDescription) ?? null,
      projectId: selectedProject?.id ?? null,
      analysisMode: "deterministic",
      summary: buildSummary(input, selectedProject, suggestionItems),
      suggestionItems,
      evidenceSnapshot: {
        selectedProject: selectedProject
          ? {
              id: selectedProject.id,
              name: selectedProject.name,
              role: selectedProject.role,
              resumeSummary: selectedProject.resumeSummary,
              outcomes: selectedProject.outcomes,
            }
          : null,
        confirmedResumeMaterials: materialEvidence.map((item) => ({
          id: item.id,
          materialType: item.materialType,
          content: item.content,
          suggestedBullet: item.suggestedBullet,
        })),
        confirmedAbilityEvidence: abilityEvidence.map((item) => ({
          id: item.id,
          abilityName: item.abilityNode.name,
          content: item.content,
        })),
      },
      sourceSnapshot: {
        confirmedResumeMaterials: sources.confirmedResumeMaterials.length,
        confirmedAbilityEvidence: sources.confirmedAbilityEvidence.length,
        availableProjects: sources.availableProjects.length,
        scopedToProjectId: selectedProject?.id ?? null,
      },
    };
  }
}

function selectProject(projects: ProjectSource[], projectId?: string): ProjectSource | null {
  if (projectId) {
    return projects.find((project) => project.id === projectId) ?? null;
  }

  return projects[0] ?? null;
}

function selectRelevantMaterials(
  materials: MaterialSource[],
  project: ProjectSource | null,
): MaterialSource[] {
  if (!project) {
    return materials.slice(0, MAX_MATERIAL_EVIDENCE);
  }

  const projectTerms = extractProjectTerms(project);
  const scored = materials
    .map((item) => ({
      item,
      score: countMatches([item.content, item.suggestedBullet].filter(Boolean).join("\n"), projectTerms),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  return (scored.length > 0 ? scored.map((item) => item.item) : materials).slice(0, MAX_MATERIAL_EVIDENCE);
}

function selectRelevantAbilityEvidence(
  evidenceItems: AbilitySource[],
  project: ProjectSource | null,
  materials: MaterialSource[],
): AbilitySource[] {
  if (!project) {
    return evidenceItems.slice(0, MAX_ABILITY_EVIDENCE);
  }

  const terms = new Set<string>([
    ...extractProjectTerms(project),
    ...materials.flatMap((item) => extractKeywords(`${item.content}\n${item.suggestedBullet ?? ""}`)),
  ]);

  const scored = evidenceItems
    .map((item) => ({
      item,
      score: countMatches(`${item.abilityNode.name}\n${item.content}`, [...terms]),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  return (scored.length > 0 ? scored.map((item) => item.item) : evidenceItems).slice(
    0,
    MAX_ABILITY_EVIDENCE,
  );
}

function buildSuggestionItems(params: {
  input: CreateProjectPackagingSuggestionsRequest;
  selectedProject: ProjectSource | null;
  materialEvidence: MaterialSource[];
  abilityEvidence: AbilitySource[];
}): ProjectPackagingSuggestionItem[] {
  const { input, selectedProject, materialEvidence, abilityEvidence } = params;
  const items: ProjectPackagingSuggestionItem[] = [];

  const projectTitleSuggestion = buildProjectTitleSuggestion(input, selectedProject, materialEvidence);
  if (projectTitleSuggestion) {
    items.push(projectTitleSuggestion);
  }

  const starSuggestion = buildStarSuggestion(input, selectedProject, materialEvidence, abilityEvidence);
  if (starSuggestion) {
    items.push(starSuggestion);
  }

  const quantifiedOutcomeSuggestion = buildQuantifiedOutcomeSuggestion(
    selectedProject,
    materialEvidence,
  );
  if (quantifiedOutcomeSuggestion) {
    items.push(quantifiedOutcomeSuggestion);
  }

  const abilityMappingSuggestion = buildAbilityMappingSuggestion(abilityEvidence, selectedProject);
  if (abilityMappingSuggestion) {
    items.push(abilityMappingSuggestion);
  }

  const gapAlertSuggestion = buildGapAlertSuggestion(
    input,
    selectedProject,
    materialEvidence,
    abilityEvidence,
  );
  if (gapAlertSuggestion) {
    items.push(gapAlertSuggestion);
  }

  return items;
}

function buildProjectTitleSuggestion(
  input: CreateProjectPackagingSuggestionsRequest,
  project: ProjectSource | null,
  materials: MaterialSource[],
): ProjectPackagingSuggestionItem | null {
  if (!project) {
    return null;
  }

  const capability =
    extractLeadPhrase(materials[0]?.suggestedBullet ?? materials[0]?.content) ??
    extractLeadPhrase(project.resumeSummary ?? project.description) ??
    "项目实现";
  const roleAnchor = input.targetRole.trim();

  return {
    id: "project-title",
    category: "project_title",
    label: "项目标题建议",
    suggestion: `${project.name} | 面向 ${roleAnchor} 的 ${capability}`,
    rationale: "优先保留真实项目名，再补一个和目标岗位直接相关的能力标签，方便在简历项目标题里快速建立上下文。",
    evidenceItems: [
      toProjectEvidence(project),
      ...materials.slice(0, 1).map(toMaterialEvidence),
    ],
  };
}

function buildStarSuggestion(
  input: CreateProjectPackagingSuggestionsRequest,
  project: ProjectSource | null,
  materials: MaterialSource[],
  abilityEvidence: AbilitySource[],
): ProjectPackagingSuggestionItem | null {
  const situation = project?.description ?? project?.resumeSummary ?? "围绕一个真实项目需求持续迭代";
  const task = normalizeOptionalText(input.targetJobDescription)
    ? "把项目经历整理成贴近目标 JD 的表达"
    : `把项目经历整理成贴近目标岗位「${input.targetRole.trim()}」的表达`;
  const action = materialLeadText(materials[0]) ?? abilityEvidence[0]?.content ?? project?.outcomes[0];
  const result = project?.outcomes[0] ?? materials[0]?.suggestedBullet ?? materials[0]?.content;

  if (!action && !result) {
    return null;
  }

  return {
    id: "resume-star",
    category: "resume_star",
    label: "STAR 草稿",
    suggestion: [
      `S/T：${truncateText(situation, 80)}，目标是 ${truncateText(task, 40)}。`,
      `A：${truncateText(action ?? "补充项目动作细节", 100)}。`,
      `R：${truncateText(result ?? "补充项目结果与产出", 90)}。`,
    ].join(" "),
    rationale: "第一版只做 deterministic 草稿拼接，帮助你把项目背景、动作和结果拆开，后续仍需要人工润色成正式简历 bullet。",
    evidenceItems: [
      ...(project ? [toProjectEvidence(project)] : []),
      ...materials.slice(0, 1).map(toMaterialEvidence),
      ...abilityEvidence.slice(0, 1).map(toAbilityEvidence),
    ],
  };
}

function buildQuantifiedOutcomeSuggestion(
  project: ProjectSource | null,
  materials: MaterialSource[],
): ProjectPackagingSuggestionItem | null {
  const outcomeSource =
    project?.outcomes.find(hasNumberLikeSignal) ??
    materials.find((item) => hasNumberLikeSignal(item.content) || hasNumberLikeSignal(item.suggestedBullet))
      ?.suggestedBullet ??
    materials.find((item) => hasNumberLikeSignal(item.content) || hasNumberLikeSignal(item.suggestedBullet))
      ?.content ??
    project?.outcomes[0] ??
    materials[0]?.suggestedBullet ??
    materials[0]?.content;

  if (!outcomeSource) {
    return null;
  }

  const prefix = hasNumberLikeSignal(outcomeSource) ? "保留现有量化结果" : "补一个可验证的量化口径";
  const suggestion = hasNumberLikeSignal(outcomeSource)
    ? `${prefix}：${truncateText(outcomeSource, 110)}`
    : `${prefix}：例如交付数量、节省时间、覆盖流程数、验证轮次或影响范围，再把结果写成一句完整 bullet。当前正式证据里还缺直接数字。`;

  return {
    id: "quantified-outcome",
    category: "quantified_outcome",
    label: "可量化成果提示",
    suggestion,
    rationale: "项目包装第一版会优先检查正式证据里有没有数字、范围或次数描述；没有的话只提示你补口径，不会虚构数据。",
    evidenceItems: [
      ...(project ? [toProjectEvidence(project)] : []),
      ...materials.slice(0, 1).map(toMaterialEvidence),
    ],
  };
}

function buildAbilityMappingSuggestion(
  abilityEvidence: AbilitySource[],
  project: ProjectSource | null,
): ProjectPackagingSuggestionItem | null {
  if (abilityEvidence.length === 0) {
    return null;
  }

  const mappedAbilities = abilityEvidence
    .slice(0, 3)
    .map((item) => `${item.abilityNode.name}：${truncateText(item.content, 48)}`)
    .join("；");

  return {
    id: "ability-mapping",
    category: "ability_mapping",
    label: "能力证据映射",
    suggestion: project
      ? `可在项目条目末尾补一句“可追溯能力证据包括：${mappedAbilities}”。`
      : `当前未指定项目，可优先挑 1 个项目，再映射这些已确认能力证据：${mappedAbilities}。`,
    rationale: "这里只回填已确认能力证据，帮助你把项目表述和正式能力档案对齐，避免把 candidate 内容误写成已证明能力。",
    evidenceItems: abilityEvidence.slice(0, 3).map(toAbilityEvidence),
  };
}

function buildGapAlertSuggestion(
  input: CreateProjectPackagingSuggestionsRequest,
  project: ProjectSource | null,
  materials: MaterialSource[],
  abilityEvidence: AbilitySource[],
): ProjectPackagingSuggestionItem | null {
  const alerts: string[] = [];

  if (!project) {
    alerts.push("当前没有选定项目，只能基于最近项目和正式证据给出泛化建议；正式投递前应先锁定一个项目条目。");
  }

  if (materials.length === 0) {
    alerts.push("当前没有已确认简历素材，项目包装建议会缺少经过确认的 bullet 依据。");
  }

  if (abilityEvidence.length === 0) {
    alerts.push("当前没有已确认能力证据，无法把项目表达映射到正式能力证明。");
  }

  if (!normalizeOptionalText(input.targetJobDescription)) {
    alerts.push("未提供 JD，岗位匹配只按 targetRole 做保守推断。");
  }

  if (alerts.length === 0) {
    alerts.push("当前已有正式证据可支撑第一版项目包装，但仍需你人工核对岗位语义、真实性和量化口径后再写入简历。");
  }

  return {
    id: "gap-alert",
    category: "gap_alert",
    label: "缺口提醒",
    suggestion: alerts.join(" "),
    rationale: "明确告诉用户哪些地方仍缺正式证据，避免把 deterministic 草稿误当成最终可投递内容。",
    evidenceItems: [
      ...(project ? [toProjectEvidence(project)] : []),
      ...materials.slice(0, 1).map(toMaterialEvidence),
      ...abilityEvidence.slice(0, 1).map(toAbilityEvidence),
    ],
  };
}

function buildSummary(
  input: CreateProjectPackagingSuggestionsRequest,
  project: ProjectSource | null,
  items: ProjectPackagingSuggestionItem[],
): string {
  const scopedText = project
    ? `已围绕项目「${project.name}」生成 ${items.length} 条初步包装建议`
    : `未指定项目，已基于当前正式证据生成 ${items.length} 条泛化包装建议`;

  return `${scopedText}，目标岗位为「${input.targetRole.trim()}」。结果来自 deterministic 规则拼接和证据筛选，只能作为 first-pass draft，不能替代你的真实经历判断或招聘方正式评价。`;
}

function extractProjectTerms(project: ProjectSource): string[] {
  return extractKeywords(
    [project.name, project.role, project.description, project.resumeSummary, ...project.outcomes]
      .filter(Boolean)
      .join("\n"),
  );
}

function countMatches(text: string, terms: string[]): number {
  return new Set(terms.filter((term) => includesNormalized(text, term))).size;
}

function extractKeywords(value: string): string[] {
  const normalized = normalizeForSearch(value);
  const words = normalized
    .split(/[^a-z0-9\u4e00-\u9fa5+#]+/i)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);

  return [...new Set(words)].slice(0, 24);
}

function includesNormalized(text: string, keyword: string): boolean {
  return normalizeForSearch(text).includes(normalizeForSearch(keyword));
}

function normalizeForSearch(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

function extractLeadPhrase(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    return null;
  }

  const phrases = normalized
    .split(/[，。；;、\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 4);

  return phrases[0] ?? null;
}

function materialLeadText(material: MaterialSource | undefined): string | null {
  if (!material) {
    return null;
  }

  return material.suggestedBullet ?? material.content;
}

function hasNumberLikeSignal(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  return /\d|一|二|三|四|五|六|七|八|九|十|多次|轮|个|项|%/i.test(value);
}

function truncateText(value: string | null | undefined, maxLength = 160): string {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    return "";
  }

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toProjectEvidence(project: ProjectSource): ProjectPackagingSuggestionEvidenceItem {
  return {
    evidenceType: "project",
    evidenceId: project.id,
    title: project.name,
    content: truncateText(
      [project.name, project.role, project.description, project.resumeSummary, ...project.outcomes]
        .filter(Boolean)
        .join("\n"),
    ),
  };
}

function toMaterialEvidence(material: MaterialSource): ProjectPackagingSuggestionEvidenceItem {
  return {
    evidenceType: "resume_material",
    evidenceId: material.id,
    title: material.materialType,
    content: truncateText(material.suggestedBullet ?? material.content),
  };
}

function toAbilityEvidence(item: AbilitySource): ProjectPackagingSuggestionEvidenceItem {
  return {
    evidenceType: "ability_evidence",
    evidenceId: item.id,
    title: item.abilityNode.name,
    content: truncateText(item.content),
  };
}
