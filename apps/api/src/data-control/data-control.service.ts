import type { ArchiveExport, ArchiveFileManifestEntry, ArchiveRestoreConflict, ArchiveRestorePreview, ArchiveRestoreRequest, ArchiveRestoreResult, DataControlOverview, DeleteAiDataRequest, DeleteAiDataResponse } from "@digital-self/shared";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import JSZip from "jszip";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { DefaultIdentityService } from "../identity/default-identity.service";
import { PrismaService } from "../prisma/prisma.service";
import type { UploadedBinaryFile } from "../imported-files/imported-files.service";
import { AiSettingsService } from "../ai-core/ai-settings.service";
import { isExternalProcessingExplicitlyAllowed } from "./external-processing-policy";
import { ArchiveRestoreService } from "./archive-restore.service";

@Injectable()
export class DataControlService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DefaultIdentityService) private readonly identity: DefaultIdentityService,
    @Inject(AiSettingsService) private readonly aiSettings: AiSettingsService,
    @Inject(ArchiveRestoreService) private readonly archiveRestore: ArchiveRestoreService,
  ) {}

  async overview(): Promise<DataControlOverview> {
    const externalAllowed = isExternalProcessingExplicitlyAllowed();
    const reportProvider = process.env.STRUCTURED_REPORT_GENERATOR_PROVIDER?.trim() || "openai-compatible";
    const searchProvider = process.env.EXTERNAL_SOURCE_SEARCH_PROVIDER?.trim() || "duckduckgo";
    const assistantSettings = await this.aiSettings.get();
    return {
      accessMode: "local_loopback_only",
      externalProcessingExplicitlyAllowed: externalAllowed,
      capabilities: [
        {
          id: "file_parsing",
          label: "历史文件解析",
          processingLocation: "local",
          provider: "local-parser",
          enabled: true,
          sendsPersonalContent: false,
          description: "PDF、DOCX、TXT 和 Markdown 在本机解析。",
        },
        {
          id: "memory_search",
          label: "长期记忆搜索",
          processingLocation: "local",
          provider: "deterministic-token-v1",
          enabled: true,
          sendsPersonalContent: false,
          description: "当前使用本机关键词相似度，不调用外部 embedding 服务。",
        },
        {
          id: "archive_search",
          label: "人生档案搜索",
          processingLocation: "local",
          provider: "domain-lexical-search",
          enabled: true,
          sendsPersonalContent: false,
          description: "每次从当前领域数据读取并做本机关键词匹配，不建立向量或搜索副本。",
        },
        {
          id: "archive_assistant",
          label: "档案助手问答",
          processingLocation: "external",
          provider: assistantSettings.enabled ? assistantSettings.baseUrl : "not-configured",
          enabled: assistantSettings.enabled && Boolean(assistantSettings.externalProcessingConsentAt),
          sendsPersonalContent: true,
          description: "启用后，只发送当前问题、最近 6 条消息和最多 8 个相关档案片段。",
        },
        {
          id: "structured_report_model",
          label: "模型生成结构化日报",
          processingLocation: reportProvider === "fake" ? "local" : "external",
          provider: reportProvider,
          enabled: reportProvider === "fake" || externalAllowed,
          sendsPersonalContent: reportProvider !== "fake",
          description: reportProvider === "fake" ? "当前使用本地验收提供器。" : "会把每日记录正文发送给配置的模型服务。",
        },
        {
          id: "external_web_search",
          label: "外部网页搜索",
          processingLocation: searchProvider === "fake" ? "local" : "external",
          provider: searchProvider,
          enabled: searchProvider === "fake" || externalAllowed,
          sendsPersonalContent: searchProvider !== "fake",
          description: searchProvider === "fake" ? "当前使用本地验收提供器。" : "会把搜索词发送给外部搜索服务。",
        },
      ],
    };
  }

  async exportArchive(): Promise<ArchiveExport> {
    const userId = await this.identity.getCurrentUserId();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, timezone: true },
    });
    if (!user) throw new NotFoundException("Current user was not found.");

    const [
      dailyEntries, memories, lifeDecisions, abilityNodes, abilityEvidence, projects,
      importedFiles, evidenceArtifacts, eventCandidates, events, resumeDocuments,
      resumeMaterials, externalSources, weeklyReviews, emotionPatterns, toolCallLogs,
      graphRelations,
      people,
      eventParticipants,
      goals,
      futurePlans,
      milestones,
      actionItems,
      aiSettings,
      aiConversations,
      aiMessages,
      sourceCitations,
      citationUses,
      proposals,
      proposalReviews,
      reviewItemHistory,
    ] = await Promise.all([
      this.prisma.dailyEntry.findMany({ where: { userId }, include: { structuredReport: true, metricRatings: true } }),
      this.prisma.memory.findMany({ where: { userId }, include: { versions: true, sourceCitation: true, evidenceSources: true } }),
      this.prisma.lifeDecision.findMany({ where: { userId }, include: { paths: true, evidenceItems: { include: { sourceCitation: true } } } }),
      this.prisma.abilityNode.findMany({ where: { userId } }),
      this.prisma.abilityEvidence.findMany({ where: { userId }, include: { sourceCitation: true, projects: true } }),
      this.prisma.project.findMany({ where: { userId }, include: { abilityEvidence: true } }),
      this.prisma.importedFile.findMany({ where: { userId } }),
      this.prisma.evidenceArtifact.findMany({ where: { userId }, include: { revisions: { include: { fragments: true } } } }),
      this.prisma.eventCandidate.findMany({ where: { userId } }),
      this.prisma.event.findMany({ where: { userId }, include: { revisions: true, sources: true, primarySourceCitation: true } }),
      this.prisma.resumeDocument.findMany({ where: { userId } }),
      this.prisma.resumeMaterial.findMany({ where: { userId } }),
      this.prisma.externalSource.findMany({ where: { userId } }),
      this.prisma.weeklyReview.findMany({ where: { userId } }),
      this.prisma.emotionPattern.findMany({ where: { userId } }),
      this.prisma.toolCallLog.findMany({ where: { userId } }),
      this.prisma.graphRelation.findMany({ where: { userId } }),
      this.prisma.person.findMany({ where: { userId } }),
      this.prisma.eventParticipant.findMany({ where: { event: { userId } } }),
      this.prisma.goal.findMany({ where: { userId } }),
      this.prisma.futurePlan.findMany({ where: { userId } }),
      this.prisma.milestone.findMany({ where: { userId } }),
      this.prisma.actionItem.findMany({ where: { userId } }),
      this.prisma.aiSettings.findMany({ where: { userId }, select: { id: true, userId: true, baseUrl: true, fastModel: true, analysisModel: true, enabled: true, externalProcessingConsentAt: true, createdAt: true, updatedAt: true } }),
      this.prisma.aiConversation.findMany({ where: { userId } }),
      this.prisma.aiMessage.findMany({ where: { conversation: { userId } } }),
      this.prisma.sourceCitation.findMany({
        where: {
          OR: [
            { userId },
            { memories: { some: { userId } } },
            { decisionEvidenceItems: { some: { decision: { userId } } } },
            { abilityEvidenceItems: { some: { userId } } },
            { eventItems: { some: { userId } } },
          ],
        },
      }),
      this.prisma.citationUse.findMany({ where: { consumerType: "ai_message", consumerId: { in: await this.prisma.aiMessage.findMany({ where: { conversation: { userId } }, select: { id: true } }).then((items) => items.map((item) => item.id)) } } }),
      this.prisma.proposal.findMany({ where: { userId } }),
      this.prisma.proposalReview.findMany({ where: { proposal: { userId } } }),
      this.prisma.reviewItemHistory.findMany({ where: { userId } }),
    ]);

    const collections: Record<string, unknown[]> = {
      dailyEntries, memories, lifeDecisions, abilityNodes, abilityEvidence, projects,
      importedFiles, evidenceArtifacts, eventCandidates, events, resumeDocuments,
      resumeMaterials, externalSources, weeklyReviews, emotionPatterns, toolCallLogs,
      graphRelations,
      people,
      eventParticipants,
      goals,
      futurePlans,
      milestones,
      actionItems,
      aiSettings,
      aiConversations,
      aiMessages,
      sourceCitations,
      citationUses,
      proposals,
      proposalReviews,
      reviewItemHistory,
    };
    return {
      schemaVersion: "digital-self-archive/v1",
      exportedAt: new Date().toISOString(),
      user,
      files: {
        rawFilesIncluded: false,
        note: "JSON contains file metadata, hashes, storage references and parsed text. Original binary files remain in local storage and are not embedded in this export yet.",
      },
      counts: Object.fromEntries(Object.entries(collections).map(([name, items]) => [name, items.length])),
      collections,
    };
  }

  async deleteAiData(input: DeleteAiDataRequest): Promise<DeleteAiDataResponse> {
    if (!input.conversations && !input.callLogs && !input.settings) throw new BadRequestException("至少选择一类要删除的 AI 数据。");
    const userId = await this.identity.getCurrentUserId();
    let conversationsDeleted = 0;
    let messagesDeleted = 0;
    let citationUsesDeleted = 0;
    let callLogsDeleted = 0;
    let settingsDeleted = 0;
    if (input.conversations) {
      const conversations = await this.prisma.aiConversation.findMany({ where: { userId }, select: { id: true } });
      const conversationIds = conversations.map((item) => item.id);
      const messages = await this.prisma.aiMessage.findMany({ where: { conversationId: { in: conversationIds } }, select: { id: true } });
      const result = await this.prisma.$transaction([
        this.prisma.citationUse.deleteMany({ where: { consumerType: "ai_message", consumerId: { in: messages.map((item) => item.id) } } }),
        this.prisma.aiMessage.deleteMany({ where: { conversationId: { in: conversationIds } } }),
        this.prisma.aiConversation.deleteMany({ where: { id: { in: conversationIds }, userId } }),
      ]);
      citationUsesDeleted = result[0].count;
      messagesDeleted = result[1].count;
      conversationsDeleted = result[2].count;
    }
    if (input.callLogs) callLogsDeleted = (await this.prisma.toolCallLog.deleteMany({ where: { userId, agentName: "archive-assistant" } })).count;
    if (input.settings) settingsDeleted = await this.aiSettings.delete();
    return { conversationsDeleted, messagesDeleted, citationUsesDeleted, callLogsDeleted, settingsDeleted };
  }

  async exportArchiveBundle(): Promise<Buffer> {
    const archive = await this.exportArchive();
    const zip = new JSZip();
    const storageRoot = path.resolve(process.env.STORAGE_DIR?.trim() || "./storage");
    const artifacts = archive.collections.evidenceArtifacts as Array<{
      id: string;
      revisions: Array<{ id: string; revisionType: string; storagePath?: string | null }>;
    }>;
    let includedFiles = 0;
    const missingFiles: string[] = [];
    const manifest: ArchiveFileManifestEntry[] = [];
    for (const artifact of artifacts) {
      for (const revision of artifact.revisions) {
        if (revision.revisionType !== "original" || !revision.storagePath) continue;
        const absolutePath = path.resolve(revision.storagePath);
        if (!absolutePath.startsWith(`${storageRoot}${path.sep}`)) {
          missingFiles.push(revision.storagePath);
          continue;
        }
        try {
          const buffer = await readFile(absolutePath);
          const archivePath = `files/${artifact.id}/${path.basename(absolutePath)}`;
          zip.file(archivePath, buffer);
          manifest.push({ archivePath, artifactId: artifact.id, revisionId: revision.id, sha256: createHash("sha256").update(buffer).digest("hex"), size: buffer.length });
          includedFiles += 1;
        } catch {
          missingFiles.push(revision.storagePath);
        }
      }
    }
    archive.files = {
      rawFilesIncluded: true,
      note: `${includedFiles} original files included. ${missingFiles.length} referenced files could not be included.`,
      manifest,
    };
    zip.file("archive.json", JSON.stringify({ ...archive, missingFiles }, null, 2));
    return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  }

  async restore(file: UploadedBinaryFile, input: ArchiveRestoreRequest): Promise<ArchiveRestoreResult> {
    if (input.mode === "replace_all" && input.confirmationText !== "替换我的全部档案") {
      throw new BadRequestException("replace_all 需要输入确认文本“替换我的全部档案”。");
    }
    const userId = await this.identity.getCurrentUserId();
    let backupPath: string | undefined;
    if (input.mode === "replace_all") {
      const backupDirectory = path.resolve(process.env.STORAGE_DIR?.trim() || "./storage", "backups");
      await mkdir(backupDirectory, { recursive: true });
      const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "_").replace("Z", "").replace(".", "_");
      backupPath = path.join(backupDirectory, `digital_self_pre_restore_${stamp}_${randomUUID().slice(0, 8)}.zip`);
      await writeFile(backupPath, await this.exportArchiveBundle(), { flag: "wx", mode: 0o600 });
    }
    return this.archiveRestore.restore(file, input.mode, userId, backupPath);
  }

  async previewRestore(file: UploadedBinaryFile): Promise<ArchiveRestorePreview> {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(file.buffer, { checkCRC32: true });
    } catch {
      throw new BadRequestException("无法读取这个 ZIP 档案包。");
    }
    const entries = Object.values(zip.files);
    if (entries.length > 10_000) throw new BadRequestException("档案包中的文件数量超过预览上限。");
    const archiveEntry = zip.file("archive.json");
    if (!archiveEntry) throw new BadRequestException("档案包中缺少 archive.json。");
    const archiveEntrySize = (archiveEntry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
    if (archiveEntrySize && archiveEntrySize > 20 * 1024 * 1024) {
      throw new BadRequestException("archive.json 超过 20MB，无法预览。");
    }

    let archive: Record<string, unknown>;
    try {
      archive = JSON.parse(await archiveEntry.async("string")) as Record<string, unknown>;
    } catch {
      throw new BadRequestException("archive.json 不是有效的 JSON。");
    }
    if (!archive || typeof archive !== "object" || Array.isArray(archive)) {
      throw new BadRequestException("archive.json 的结构无法识别。");
    }
    const collections = archive.collections;
    if (!collections || typeof collections !== "object" || Array.isArray(collections)) {
      throw new BadRequestException("archive.json 缺少 collections。");
    }
    for (const [name, records] of Object.entries(collections)) {
      if (!Array.isArray(records)) throw new BadRequestException(`collections.${name} 必须是数组。`);
    }

    const userId = await this.identity.getCurrentUserId();
    const currentIds = await this.loadCurrentArchiveIds(userId);
    const collectionCounts: Record<string, number> = {};
    const conflicts: ArchiveRestoreConflict[] = [];
    const warnings: string[] = [];
    let totalRecords = 0;
    for (const [name, records] of Object.entries(collections as Record<string, unknown[]>)) {
      collectionCounts[name] = records.length;
      totalRecords += records.length;
      const existingIds = currentIds[name];
      for (const record of records) {
        const id = record && typeof record === "object" && !Array.isArray(record) && typeof (record as { id?: unknown }).id === "string"
          ? (record as { id: string }).id
          : undefined;
        if (!id) {
          warnings.push(`${name} 中有记录缺少字符串 id。`);
        } else if (existingIds?.has(id) && conflicts.length < 500) {
          conflicts.push({ collection: name, id, reason: "id_exists" });
        }
      }
    }

    const conflictCount = countArchiveConflicts(collections as Record<string, unknown[]>, currentIds);
    if (conflictCount > conflicts.length) warnings.push(`冲突明细只展示前 ${conflicts.length} 条。`);
    const schemaVersion = typeof archive.schemaVersion === "string" ? archive.schemaVersion : "unknown";
    const supported = schemaVersion === "digital-self-archive/v1";
    if (!supported) warnings.push(`当前程序不支持档案版本 ${schemaVersion}。`);
    const currentRecordCount = Object.values(currentIds).reduce((sum, ids) => sum + ids.size, 0);
    const missingFiles = Array.isArray(archive.missingFiles)
      ? archive.missingFiles.filter((value): value is string => typeof value === "string")
      : [];
    const bundleFileCount = entries.filter((entry) => !entry.dir && entry.name !== "archive.json").length;
    const archiveUser = archive.user && typeof archive.user === "object" && !Array.isArray(archive.user)
      ? archive.user as { id?: unknown }
      : undefined;

    return {
      schemaVersion,
      supported,
      exportedAt: typeof archive.exportedAt === "string" ? archive.exportedAt : undefined,
      archiveUserId: typeof archiveUser?.id === "string" ? archiveUser.id : undefined,
      collectionCounts,
      totalRecords,
      bundleFileCount,
      missingFiles,
      conflicts,
      conflictCount,
      warnings: Array.from(new Set(warnings)).slice(0, 200),
      currentDatabase: {
        hasExistingData: currentRecordCount > 0,
        recordCount: currentRecordCount,
      },
      canRestoreToEmptyDatabase: supported && currentRecordCount === 0 && conflictCount === 0 && warnings.length === 0,
    };
  }

  private async loadCurrentArchiveIds(userId: string): Promise<Record<string, Set<string>>> {
    const [
      dailyEntries, memories, lifeDecisions, abilityNodes, abilityEvidence, projects,
      importedFiles, evidenceArtifacts, eventCandidates, events, resumeDocuments,
      resumeMaterials, externalSources, weeklyReviews, emotionPatterns, toolCallLogs,
      graphRelations, people, eventParticipants,
      goals, futurePlans, milestones, actionItems,
      aiSettings, aiConversations, aiMessages, sourceCitations, citationUses,
      proposals, proposalReviews,
      reviewItemHistory,
    ] = await Promise.all([
      this.prisma.dailyEntry.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.memory.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.lifeDecision.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.abilityNode.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.abilityEvidence.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.project.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.importedFile.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.evidenceArtifact.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.eventCandidate.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.event.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.resumeDocument.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.resumeMaterial.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.externalSource.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.weeklyReview.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.emotionPattern.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.toolCallLog.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.graphRelation.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.person.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.eventParticipant.findMany({ where: { event: { userId } }, select: { id: true } }),
      this.prisma.goal.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.futurePlan.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.milestone.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.actionItem.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.aiSettings.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.aiConversation.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.aiMessage.findMany({ where: { conversation: { userId } }, select: { id: true } }),
      this.prisma.sourceCitation.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.citationUse.findMany({ where: { consumerType: "ai_message", consumerId: { in: await this.prisma.aiMessage.findMany({ where: { conversation: { userId } }, select: { id: true } }).then((items) => items.map((item) => item.id)) } }, select: { id: true } }),
      this.prisma.proposal.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.proposalReview.findMany({ where: { proposal: { userId } }, select: { id: true } }),
      this.prisma.reviewItemHistory.findMany({ where: { userId }, select: { id: true } }),
    ]);
    const names = [
      "dailyEntries", "memories", "lifeDecisions", "abilityNodes", "abilityEvidence", "projects",
      "importedFiles", "evidenceArtifacts", "eventCandidates", "events", "resumeDocuments",
      "resumeMaterials", "externalSources", "weeklyReviews", "emotionPatterns", "toolCallLogs",
      "graphRelations", "people", "eventParticipants",
      "goals", "futurePlans", "milestones", "actionItems",
      "aiSettings", "aiConversations", "aiMessages", "sourceCitations", "citationUses",
      "proposals", "proposalReviews",
      "reviewItemHistory",
    ];
    const records = [
      dailyEntries, memories, lifeDecisions, abilityNodes, abilityEvidence, projects,
      importedFiles, evidenceArtifacts, eventCandidates, events, resumeDocuments,
      resumeMaterials, externalSources, weeklyReviews, emotionPatterns, toolCallLogs,
      graphRelations, people, eventParticipants,
      goals, futurePlans, milestones, actionItems,
      aiSettings, aiConversations, aiMessages, sourceCitations, citationUses,
      proposals, proposalReviews,
      reviewItemHistory,
    ];
    return Object.fromEntries(names.map((name, index) => [name, new Set(records[index].map((item) => item.id))]));
  }
}

function countArchiveConflicts(
  collections: Record<string, unknown[]>,
  currentIds: Record<string, Set<string>>,
): number {
  let count = 0;
  for (const [name, records] of Object.entries(collections)) {
    const existingIds = currentIds[name];
    if (!existingIds) continue;
    for (const record of records) {
      const id = record && typeof record === "object" && !Array.isArray(record)
        ? (record as { id?: unknown }).id
        : undefined;
      if (typeof id === "string" && existingIds.has(id)) count += 1;
    }
  }
  return count;
}
