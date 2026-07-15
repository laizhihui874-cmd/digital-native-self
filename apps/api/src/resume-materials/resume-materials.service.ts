import type {
  CreateResumeMaterialRequest,
  ExtractResumeMaterialCandidatesResponse,
  ListResumeMaterialsResponse,
  ResumeMaterial,
  ResumeMaterialSourceType,
  ReviewResumeMaterialRequest,
  StructuredTextItem,
} from "@digital-self/shared";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { DefaultIdentityService } from "../identity/default-identity.service";
import {
  ResumeMaterialsRepository,
  type ExtractionSourceBundle,
} from "./resume-materials.repository";

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;
const DEFAULT_SOURCE_TYPE = "manual";
const DEFAULT_MATERIAL_TYPE = "other";
const DEFAULT_STATUS = "candidate";
const DEFAULT_LIMIT_PER_SOURCE = 3;
const MAX_LIMIT_PER_SOURCE = 10;

type ExtractedResumeMaterialCandidate = {
  sourceType: ResumeMaterialSourceType;
  sourceId: string;
  materialType: ResumeMaterial["materialType"];
  content: string;
  suggestedBullet: string | null;
};

@Injectable()
export class ResumeMaterialsService {
  constructor(
    @Inject(ResumeMaterialsRepository)
    private readonly resumeMaterialsRepository: ResumeMaterialsRepository,
    @Inject(DefaultIdentityService)
    private readonly identityService: DefaultIdentityService,
  ) {}

  async create(input: CreateResumeMaterialRequest): Promise<ResumeMaterial> {
    const userId = await this.identityService.getCurrentUserId();
    const sourceType = input.sourceType ?? DEFAULT_SOURCE_TYPE;
    const sourceId = normalizeSourceId(sourceType, input.sourceId);

    await this.assertSourceExists(userId, sourceType, sourceId);

    return this.resumeMaterialsRepository.create(userId, {
      sourceType,
      sourceId,
      materialType: input.materialType ?? DEFAULT_MATERIAL_TYPE,
      content: normalizeRequiredContent(input.content),
      suggestedBullet: normalizeOptionalTextToNull(input.suggestedBullet),
      status: input.status ?? DEFAULT_STATUS,
      confidence: normalizeConfidence(input.confidence),
    });
  }

  async extractCandidates(input: {
    limitPerSource?: number;
  } = {}): Promise<ExtractResumeMaterialCandidatesResponse> {
    const userId = await this.identityService.getCurrentUserId();
    const limitPerSource = normalizeLimitPerSource(input.limitPerSource);
    const sources = await this.resumeMaterialsRepository.listExtractionSources(userId);
    const extractedCandidates = buildExtractedCandidates(sources, limitPerSource);
    const existing = await this.resumeMaterialsRepository.findExistingForSources(
      userId,
      extractedCandidates.map((candidate) => ({
        sourceType: candidate.sourceType,
        sourceId: candidate.sourceId,
      })),
    );
    const knownKeys = new Set(existing.map((item) => buildMaterialKey(item)));
    const created: ResumeMaterial[] = [];
    let skippedCount = 0;

    for (const candidate of extractedCandidates) {
      const key = buildMaterialKey(candidate);

      if (knownKeys.has(key)) {
        skippedCount += 1;
        continue;
      }

      const createdMaterial = await this.resumeMaterialsRepository.create(userId, {
        sourceType: candidate.sourceType,
        sourceId: candidate.sourceId,
        materialType: candidate.materialType,
        content: candidate.content,
        suggestedBullet: candidate.suggestedBullet,
        status: DEFAULT_STATUS,
        confidence: null,
      });

      knownKeys.add(key);
      created.push(createdMaterial);
    }

    return {
      created,
      skippedCount,
      scanned: {
        abilityEvidence: sources.abilityEvidence.length,
        projects: sources.projects.length,
        resumeDocuments: sources.resumeDocuments.length,
        dailyEntries: sources.dailyEntries.length,
      },
    };
  }

  async list(query: {
    status?: ResumeMaterial["status"];
    sourceType?: ResumeMaterial["sourceType"];
    limit?: number;
    offset?: number;
  }): Promise<ListResumeMaterialsResponse> {
    const userId = await this.identityService.getCurrentUserId();

    return this.resumeMaterialsRepository.list({
      userId,
      status: query.status,
      sourceType: query.sourceType,
      limit: query.limit ?? DEFAULT_LIMIT,
      offset: query.offset ?? DEFAULT_OFFSET,
    });
  }

  async findById(id: string): Promise<ResumeMaterial> {
    const userId = await this.identityService.getCurrentUserId();
    const material = await this.resumeMaterialsRepository.findById(userId, id);

    if (!material) {
      throw new NotFoundException(`ResumeMaterial ${id} was not found.`);
    }

    return material;
  }

  async review(id: string, input: ReviewResumeMaterialRequest): Promise<ResumeMaterial> {
    const userId = await this.identityService.getCurrentUserId();
    const material = await this.resumeMaterialsRepository.review(userId, id, {
      status: input.status,
      content: input.content === undefined ? undefined : normalizeRequiredContent(input.content),
      suggestedBullet:
        input.suggestedBullet === undefined
          ? undefined
          : normalizeOptionalTextToNull(input.suggestedBullet),
      materialType: input.materialType,
    });

    if (!material) {
      throw new NotFoundException(`ResumeMaterial ${id} was not found.`);
    }

    return material;
  }

  async delete(id: string): Promise<void> {
    const userId = await this.identityService.getCurrentUserId();
    const deleted = await this.resumeMaterialsRepository.delete(userId, id);

    if (!deleted) {
      throw new NotFoundException(`ResumeMaterial ${id} was not found.`);
    }
  }

  private async assertSourceExists(
    userId: string,
    sourceType: ResumeMaterialSourceType,
    sourceId: string | null,
  ): Promise<void> {
    const exists = await this.resumeMaterialsRepository.sourceExists(userId, sourceType, sourceId);

    if (!exists) {
      throw new NotFoundException(`Source ${sourceType}:${sourceId ?? "missing"} was not found.`);
    }
  }
}

function buildExtractedCandidates(
  sources: ExtractionSourceBundle,
  limitPerSource: number,
): ExtractedResumeMaterialCandidate[] {
  return [
    ...sources.abilityEvidence.flatMap((item) =>
      limitCandidates(buildAbilityEvidenceCandidates(item), limitPerSource),
    ),
    ...sources.projects.flatMap((item) =>
      limitCandidates(buildProjectCandidates(item), limitPerSource),
    ),
    ...sources.resumeDocuments.flatMap((item) =>
      limitCandidates(buildResumeDocumentCandidates(item), limitPerSource),
    ),
    ...sources.dailyEntries.flatMap((item) =>
      limitCandidates(buildDailyEntryCandidates(item), limitPerSource),
    ),
  ];
}

function normalizeRequiredContent(value: string): string {
  if (typeof value !== "string") {
    throw new BadRequestException("Field 'content' must be a string.");
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new BadRequestException("Field 'content' must not be empty.");
  }

  return trimmed;
}

function normalizeOptionalTextToNull(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeConfidence(value: number | null | undefined): number | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new BadRequestException("Field 'confidence' must be a number between 0 and 1.");
  }

  return value;
}

function normalizeSourceId(
  sourceType: ResumeMaterialSourceType,
  sourceId: string | null | undefined,
): string | null {
  if (sourceType === "manual") {
    return null;
  }

  return sourceId ?? null;
}

function normalizeLimitPerSource(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_LIMIT_PER_SOURCE;
  }

  if (!Number.isInteger(value) || value < 1 || value > MAX_LIMIT_PER_SOURCE) {
    throw new BadRequestException(
      `Field 'limitPerSource' must be an integer between 1 and ${MAX_LIMIT_PER_SOURCE}.`,
    );
  }

  return value;
}

function buildAbilityEvidenceCandidates(source: ExtractionSourceBundle["abilityEvidence"][number]) {
  const content = normalizeCandidateText(source.content);
  const abilityName = normalizeCandidateText(source.abilityNode.name);
  const candidates: ExtractedResumeMaterialCandidate[] = [];

  if (content) {
    candidates.push({
      sourceType: "ability_evidence",
      sourceId: source.id,
      materialType: "skill",
      content: abilityName ? `${abilityName}: ${content}` : content,
      suggestedBullet: content,
    });
  }

  if (content && (source.impact === "positive" || source.impactScore >= 4 || source.feedbackScore > 0)) {
    candidates.push({
      sourceType: "ability_evidence",
      sourceId: source.id,
      materialType: "achievement",
      content,
      suggestedBullet: content,
    });
  }

  return candidates;
}

function buildProjectCandidates(source: ExtractionSourceBundle["projects"][number]) {
  const candidates: ExtractedResumeMaterialCandidate[] = [];
  const summary = normalizeCandidateText(source.resumeSummary);

  if (summary) {
    candidates.push({
      sourceType: "project",
      sourceId: source.id,
      materialType: "project_summary",
      content: summary,
      suggestedBullet: summary,
    });
  }

  for (const outcome of source.outcomes) {
    const normalizedOutcome = normalizeCandidateText(outcome);

    if (!normalizedOutcome) {
      continue;
    }

    candidates.push({
      sourceType: "project",
      sourceId: source.id,
      materialType: "project_summary",
      content: normalizedOutcome,
      suggestedBullet: normalizedOutcome,
    });
  }

  return candidates;
}

function buildResumeDocumentCandidates(source: ExtractionSourceBundle["resumeDocuments"][number]) {
  return source.content
    .split(/\r?\n/)
    .map((line) => normalizeCandidateText(stripListPrefix(line)))
    .filter((line): line is string => Boolean(line))
    .map((line) => ({
      sourceType: "resume_document" as const,
      sourceId: source.id,
      materialType: "other" as const,
      content: line,
      suggestedBullet: line,
    }));
}

function buildDailyEntryCandidates(source: ExtractionSourceBundle["dailyEntries"][number]) {
  return [
    ...source.structuredReport.growthEvidence.flatMap((item) => {
      const content = normalizeCandidateText(formatStructuredTextItem(item));

      if (!content) {
        return [];
      }

      return [
        {
          sourceType: "daily_entry" as const,
          sourceId: source.id,
          materialType: "reflection" as const,
          content,
          suggestedBullet: content,
        },
      ];
    }),
    ...source.structuredReport.workItems.flatMap((item) => {
      const content = normalizeCandidateText(formatStructuredTextItem(item));

      if (!content) {
        return [];
      }

      return [
        {
          sourceType: "daily_entry" as const,
          sourceId: source.id,
          materialType: "responsibility" as const,
          content,
          suggestedBullet: content,
        },
      ];
    }),
  ];
}

function limitCandidates<T>(items: T[], limit: number): T[] {
  return items.slice(0, limit);
}

function formatStructuredTextItem(item: StructuredTextItem): string {
  const title = normalizeCandidateText(item.title);
  const detail = normalizeCandidateText(item.detail);

  if (!detail) {
    return "";
  }

  if (!title) {
    return detail;
  }

  return `${title}: ${detail}`;
}

function stripListPrefix(value: string): string {
  return value.replace(/^\s*(?:[-*•]\s+|\d+[.)]\s+)/, "");
}

function normalizeCandidateText(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

function normalizeKeyText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function buildMaterialKey(input: {
  sourceType: ResumeMaterialSourceType;
  sourceId: string | null;
  materialType: ResumeMaterial["materialType"];
  content: string;
}): string {
  return [
    input.sourceType,
    input.sourceId ?? "",
    input.materialType,
    normalizeKeyText(input.content),
  ].join("::");
}
