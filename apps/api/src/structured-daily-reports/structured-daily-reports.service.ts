import type {
  CreateStructuredDailyReportMemoryCandidatesResponse,
  CreateStructuredDailyReportRequest,
  MemoryType,
  StructuredDailyReport,
  StructuredTextItem,
} from "@digital-self/shared";
import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { DefaultIdentityService } from "../identity/default-identity.service";
import { assertExternalProcessingAllowed } from "../data-control/external-processing-policy";
import { MemoriesRepository } from "../memories/memories.repository";
import {
  generateStructuredDailyReportWithModel,
  StructuredReportGeneratorConfigurationError,
  StructuredReportGeneratorExecutionError,
  StructuredReportGeneratorOutputError,
} from "./structured-report-generator";
import { StructuredDailyReportsRepository } from "./structured-daily-reports.repository";
import { buildLocalStructuredDailyReportDraft } from "./structured-report-draft.builder";

type ExtractedMemoryCandidate = {
  memoryType: MemoryType;
  content: string;
};

const GENERIC_SECTION_TITLES = new Set([
  "事实",
  "关键事实",
  "情绪",
  "工作项",
  "实施",
  "反馈",
  "成长证据",
  "消耗来源",
  "后续动作",
  "明日行动",
  "决策影响",
  "fact",
  "facts",
  "emotion",
  "emotions",
  "feedback",
  "growth evidence",
  "next action",
  "next actions",
  "decision impact",
  "work item",
  "work items",
  "本地草稿",
  "local draft",
]);

const EVENT_KEYWORDS = [
  "完成",
  "提交",
  "发布",
  "上线",
  "开始",
  "启动",
  "推进",
  "处理",
  "解决",
  "修复",
  "沟通",
  "面试",
  "开会",
  "复盘",
  "决定",
  "确定",
  "选择",
  "申请",
  "收到",
  "参加",
  "搭建",
  "开发",
  "实现",
  "交付",
  "整理",
  "完成了",
  "完成了对",
  "completed",
  "launched",
  "fixed",
  "shipped",
];

@Injectable()
export class StructuredDailyReportsService {
  private readonly structuredDailyReportsRepository: StructuredDailyReportsRepository;
  private readonly memoriesRepository: MemoriesRepository;
  private readonly identityService: DefaultIdentityService;

  constructor(
    @Inject(StructuredDailyReportsRepository) structuredDailyReportsRepository: StructuredDailyReportsRepository,
    @Inject(MemoriesRepository) memoriesRepository: MemoriesRepository,
    @Inject(DefaultIdentityService) identityService: DefaultIdentityService,
  ) {
    this.structuredDailyReportsRepository = structuredDailyReportsRepository;
    this.memoriesRepository = memoriesRepository;
    this.identityService = identityService;
  }

  async create(input: CreateStructuredDailyReportRequest): Promise<StructuredDailyReport> {
    const userId = await this.identityService.getCurrentUserId();
    await this.assertDailyEntryCanCreateReport(userId, input.dailyEntryId);

    try {
      return await this.structuredDailyReportsRepository.create(input);
    } catch (error) {
      if (isStructuredDailyReportUniqueConstraintError(error)) {
        throw new ConflictException(
          `StructuredDailyReport already exists for DailyEntry ${input.dailyEntryId}.`,
        );
      }

      throw error;
    }
  }

  async createDraftForDailyEntry(dailyEntryId: string): Promise<StructuredDailyReport> {
    const userId = await this.identityService.getCurrentUserId();
    const dailyEntry = await this.assertDailyEntryCanCreateReport(userId, dailyEntryId);
    const draft = buildLocalStructuredDailyReportDraft({
      dailyEntryId,
      rawContent: dailyEntry.rawContent,
    });

    try {
      return await this.structuredDailyReportsRepository.create(draft);
    } catch (error) {
      if (isStructuredDailyReportUniqueConstraintError(error)) {
        throw new ConflictException(`StructuredDailyReport already exists for DailyEntry ${dailyEntryId}.`);
      }

      throw error;
    }
  }

  async generateForDailyEntry(dailyEntryId: string): Promise<StructuredDailyReport> {
    const userId = await this.identityService.getCurrentUserId();
    const dailyEntry = await this.assertDailyEntryCanCreateReport(userId, dailyEntryId);
    if ((process.env.STRUCTURED_REPORT_GENERATOR_PROVIDER?.trim() || "openai-compatible") !== "fake") {
      assertExternalProcessingAllowed("Structured report generation");
    }

    let generated;

    try {
      generated = await generateStructuredDailyReportWithModel({
        dailyEntryId,
        rawContent: dailyEntry.rawContent,
      });
    } catch (error) {
      if (error instanceof StructuredReportGeneratorConfigurationError) {
        throw new ServiceUnavailableException(error.message);
      }

      if (
        error instanceof StructuredReportGeneratorExecutionError ||
        error instanceof StructuredReportGeneratorOutputError
      ) {
        throw new BadGatewayException(error.message);
      }

      throw error;
    }

    try {
      return await this.structuredDailyReportsRepository.createWithMetricRatings(
        generated.structuredReport,
        generated.metricRatings,
      );
    } catch (error) {
      if (isStructuredDailyReportUniqueConstraintError(error)) {
        throw new ConflictException(`StructuredDailyReport already exists for DailyEntry ${dailyEntryId}.`);
      }

      throw error;
    }
  }

  async findByDailyEntryId(dailyEntryId: string): Promise<StructuredDailyReport> {
    const userId = await this.identityService.getCurrentUserId();
    const report = await this.structuredDailyReportsRepository.findByDailyEntryId(userId, dailyEntryId);

    if (!report) {
      throw new NotFoundException(`StructuredDailyReport for DailyEntry ${dailyEntryId} was not found.`);
    }

    return report;
  }

  async createMemoryCandidates(
    dailyEntryId: string,
  ): Promise<CreateStructuredDailyReportMemoryCandidatesResponse> {
    const userId = await this.identityService.getCurrentUserId();
    const dailyEntry = await this.structuredDailyReportsRepository.findOwnedDailyEntryById(
      userId,
      dailyEntryId,
    );

    if (!dailyEntry) {
      throw new NotFoundException(`DailyEntry ${dailyEntryId} was not found.`);
    }

    const report = await this.structuredDailyReportsRepository.findByDailyEntryId(userId, dailyEntryId);

    if (!report) {
      throw new NotFoundException(`StructuredDailyReport for DailyEntry ${dailyEntryId} was not found.`);
    }

    const extractedCandidates = extractMemoryCandidates(report);
    const uniqueCandidates = deduplicateExtractedCandidates(extractedCandidates);
    const existingMemories = await this.memoriesRepository.findExistingCandidateOrConfirmedByContents(
      userId,
      uniqueCandidates.map((candidate) => candidate.content),
    );
    const existingContentKeys = new Set(
      existingMemories.map((memory) => normalizeCandidateKey(memory.content)),
    );
    const candidatesToCreate = uniqueCandidates.filter(
      (candidate) => !existingContentKeys.has(normalizeCandidateKey(candidate.content)),
    );

    let sourceCitationId: string | undefined;

    if (candidatesToCreate.length > 0) {
      const existingCitation = await this.memoriesRepository.findSourceCitationBySource(
        "daily_entry",
        dailyEntryId,
      );

      if (existingCitation) {
        sourceCitationId = existingCitation.id;
      } else {
        const createdCitation = await this.memoriesRepository.createSourceCitation({
          sourceType: "daily_entry",
          sourceId: dailyEntryId,
          title: buildDailyEntryCitationTitle(dailyEntry.recordedAt ?? dailyEntry.createdAt),
          excerpt: buildDailyEntryCitationExcerpt(dailyEntry.rawContent),
          locator: `structured-daily-report:${report.id}`,
        });
        sourceCitationId = createdCitation.id;
      }
    }

    const created = await Promise.all(
      candidatesToCreate.map((candidate) =>
        this.memoriesRepository.create(userId, {
          memoryType: candidate.memoryType,
          content: candidate.content,
          status: "candidate",
          isMomentaryThought: false,
          sourceCitationId,
        }),
      ),
    );

    return {
      source: {
        dailyEntryId,
        structuredReportId: report.id,
      },
      created,
      skippedCount: extractedCandidates.length - created.length,
    };
  }

  private async assertDailyEntryCanCreateReport(userId: string, dailyEntryId: string) {
    const ownedDailyEntry = await this.structuredDailyReportsRepository.findOwnedDailyEntryById(
      userId,
      dailyEntryId,
    );

    if (!ownedDailyEntry) {
      throw new NotFoundException(`DailyEntry ${dailyEntryId} was not found.`);
    }

    const existingReport = await this.structuredDailyReportsRepository.findByDailyEntryId(
      userId,
      dailyEntryId,
    );

    if (existingReport) {
      throw new ConflictException(`StructuredDailyReport already exists for DailyEntry ${dailyEntryId}.`);
    }

    return ownedDailyEntry;
  }
}

function isStructuredDailyReportUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function extractMemoryCandidates(report: StructuredDailyReport): ExtractedMemoryCandidate[] {
  return [
    ...mapStructuredItemsToCandidates(report.growthEvidence, "ability"),
    ...mapStructuredItemsToCandidates(report.nextActions, "goal"),
    ...mapStructuredItemsToCandidates(report.decisionImpact, "decision"),
    ...mapEventCandidates(report.facts),
    ...mapEventCandidates(report.workItems),
  ];
}

function mapStructuredItemsToCandidates(
  items: StructuredTextItem[],
  memoryType: MemoryType,
): ExtractedMemoryCandidate[] {
  return items.flatMap((item) => {
    const content = buildCandidateContent(item);

    if (!isMeaningfulMemoryCandidate(content)) {
      return [];
    }

    return [{ memoryType, content }];
  });
}

function mapEventCandidates(items: StructuredTextItem[]): ExtractedMemoryCandidate[] {
  return items.flatMap((item) => {
    const content = buildCandidateContent(item);

    if (!isMeaningfulMemoryCandidate(content) || !looksLikeKeyEvent(content)) {
      return [];
    }

    return [{ memoryType: "event", content }];
  });
}

function deduplicateExtractedCandidates(
  candidates: ExtractedMemoryCandidate[],
): ExtractedMemoryCandidate[] {
  const seen = new Set<string>();
  const unique: ExtractedMemoryCandidate[] = [];

  for (const candidate of candidates) {
    const key = normalizeCandidateKey(candidate.content);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(candidate);
  }

  return unique;
}

function buildCandidateContent(item: StructuredTextItem): string {
  const title = normalizeCandidateText(item.title);
  const detail = normalizeCandidateText(item.detail);

  if (!detail) {
    return "";
  }

  if (!title || !isInformativeTitle(title) || detail.includes(title)) {
    return detail;
  }

  return `${title}: ${detail}`;
}

function isMeaningfulMemoryCandidate(content: string): boolean {
  if (content.length < 6) {
    return false;
  }

  const lowered = content.toLowerCase();
  return !["无", "暂无", "none", "n/a", "na"].includes(lowered);
}

function looksLikeKeyEvent(content: string): boolean {
  if (content.length < 8 || content.length > 200) {
    return false;
  }

  return EVENT_KEYWORDS.some((keyword) => content.toLowerCase().includes(keyword.toLowerCase()));
}

function isInformativeTitle(title: string): boolean {
  return !GENERIC_SECTION_TITLES.has(title.toLowerCase());
}

function normalizeCandidateText(value: string | undefined): string {
  if (!value) {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

function normalizeCandidateKey(content: string): string {
  return normalizeCandidateText(content).toLowerCase();
}

function buildDailyEntryCitationTitle(recordedAt: Date): string {
  return `DailyEntry ${recordedAt.toISOString().slice(0, 10)}`;
}

function buildDailyEntryCitationExcerpt(rawContent: string): string {
  const excerpt = normalizeCandidateText(rawContent).slice(0, 160);
  return excerpt.length > 0 ? excerpt : "Daily entry source";
}
