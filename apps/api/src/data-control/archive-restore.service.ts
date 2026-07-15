import type { ArchiveFileManifestEntry, ArchiveRestoreMode, ArchiveRestoreResult } from "@digital-self/shared";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import JSZip from "jszip";
import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { UploadedBinaryFile } from "../imported-files/imported-files.service";
import { PrismaService } from "../prisma/prisma.service";

const MAX_ARCHIVE_JSON_BYTES = 20 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 250 * 1024 * 1024;
const MAX_ENTRY_BYTES = 75 * 1024 * 1024;
const MAX_ENTRIES = 10_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SUPPORTED_COLLECTIONS = new Set([
  "dailyEntries", "memories", "lifeDecisions", "abilityNodes", "abilityEvidence", "projects",
  "importedFiles", "evidenceArtifacts", "eventCandidates", "events", "resumeDocuments",
  "resumeMaterials", "externalSources", "weeklyReviews", "emotionPatterns", "toolCallLogs",
  "graphRelations", "people", "eventParticipants", "goals", "futurePlans", "milestones",
  "actionItems", "aiSettings", "aiConversations", "aiMessages", "sourceCitations", "citationUses",
  "proposals", "proposalReviews", "reviewItemHistory",
]);

type ArchiveRecord = Record<string, unknown>;
type ParsedArchive = {
  schemaVersion: string;
  user: { id?: string; displayName?: string | null; timezone?: string | null };
  counts: Record<string, number>;
  collections: Record<string, ArchiveRecord[]>;
  files?: { manifest?: ArchiveFileManifestEntry[] };
  missingFiles: string[];
};

type FlatArchive = Record<string, ArchiveRecord[]>;
type PreparedFile = ArchiveFileManifestEntry & { buffer: Buffer; relativeStoragePath: string; stagedPath: string };
type CreateManyDelegate = { createMany(args: { data: ArchiveRecord[]; skipDuplicates?: boolean }): Promise<{ count: number }> };

@Injectable()
export class ArchiveRestoreService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async restore(
    file: UploadedBinaryFile,
    mode: ArchiveRestoreMode,
    currentUserId: string,
    backupPath?: string,
  ): Promise<ArchiveRestoreResult> {
    const storageRoot = path.resolve(process.env.STORAGE_DIR?.trim() || "./storage");
    const quarantineRoot = path.join(storageRoot, "restore-quarantine");
    const stagingRoot = path.join(storageRoot, "restore-staging", randomUUID());
    await mkdir(quarantineRoot, { recursive: true });
    const quarantine = await mkdtemp(path.join(quarantineRoot, "restore-"));
    let oldEvidencePath: string | undefined;
    const installedFiles: string[] = [];
    try {
      const { archive, zip } = await parseArchive(file);
      const flat = flattenArchive(archive, currentUserId);
      validateArchiveReferences(flat, mode);
      const prepared = await prepareFiles(zip, archive, flat, currentUserId, storageRoot, quarantine);
      applyRestoredStoragePaths(flat, prepared);

      const evidenceRoot = path.join(storageRoot, "evidence", currentUserId);
      if (mode === "replace_all" && await exists(evidenceRoot)) {
        await mkdir(stagingRoot, { recursive: true });
        oldEvidencePath = path.join(stagingRoot, "old-evidence");
        await rename(evidenceRoot, oldEvidencePath);
      }

      const collectionResults: ArchiveRestoreResult["collections"] = {};
      let replaced = 0;
      try {
        await this.prisma.$transaction(async (tx) => {
          if (mode === "replace_all") replaced = await deleteCurrentArchiveData(tx, currentUserId);
          if (mode === "replace_all") {
            await tx.user.update({
              where: { id: currentUserId },
              data: {
                displayName: archive.user.displayName ?? null,
                timezone: archive.user.timezone ?? null,
              },
            });
          }
          await insertFlatArchive(tx, flat, mode, collectionResults);
          for (const item of prepared) {
            const finalPath = path.resolve(process.cwd(), item.relativeStoragePath);
            assertWithin(finalPath, storageRoot, "恢复文件目标路径越出存储目录。");
            if (mode === "merge_skip" && await exists(finalPath)) continue;
            await mkdir(path.dirname(finalPath), { recursive: true });
            await rename(item.stagedPath, finalPath);
            installedFiles.push(finalPath);
          }
        }, { maxWait: 15_000, timeout: 180_000 });
      } catch (error) {
        for (const installed of installedFiles.reverse()) await rm(installed, { force: true });
        if (oldEvidencePath) {
          await rm(evidenceRoot, { recursive: true, force: true });
          await mkdir(path.dirname(evidenceRoot), { recursive: true });
          await rename(oldEvidencePath, evidenceRoot);
          oldEvidencePath = undefined;
        }
        throw restoreDatabaseError(error);
      }

      const imported = Object.values(collectionResults).reduce((sum, item) => sum + item.imported, 0);
      const skipped = Object.values(collectionResults).reduce((sum, item) => sum + item.skipped, 0);
      return {
        mode,
        imported,
        skipped,
        replaced,
        filesRestored: installedFiles.length,
        missingFiles: archive.missingFiles,
        failed: 0,
        backupPath,
        collections: collectionResults,
      };
    } finally {
      await rm(quarantine, { recursive: true, force: true });
      if (oldEvidencePath) await rm(stagingRoot, { recursive: true, force: true });
    }
  }
}

async function parseArchive(file: UploadedBinaryFile): Promise<{ archive: ParsedArchive; zip: JSZip }> {
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(file.buffer, { checkCRC32: true, createFolders: true }); }
  catch { throw new BadRequestException("无法读取这个 ZIP 档案包。"); }
  const entries = Object.values(zip.files);
  if (entries.length > MAX_ENTRIES) throw new BadRequestException("档案包中的文件数量超过上限。");
  let uncompressedTotal = 0;
  for (const entry of entries) {
    validateZipEntry(entry);
    const size = zipEntrySize(entry);
    if (size > MAX_ENTRY_BYTES) throw new BadRequestException(`档案条目 ${entry.name} 超过大小上限。`);
    uncompressedTotal += size;
  }
  if (uncompressedTotal > MAX_UNCOMPRESSED_BYTES) throw new BadRequestException("档案包解压后的总大小超过上限。");
  const archiveEntry = zip.file("archive.json");
  if (!archiveEntry) throw new BadRequestException("档案包中缺少 archive.json。");
  if (zipEntrySize(archiveEntry) > MAX_ARCHIVE_JSON_BYTES) throw new BadRequestException("archive.json 超过 20MB。");

  let raw: ArchiveRecord;
  try { raw = JSON.parse(await archiveEntry.async("string")) as ArchiveRecord; }
  catch { throw new BadRequestException("archive.json 不是有效的 JSON。"); }
  if (raw.schemaVersion !== "digital-self-archive/v1") throw new BadRequestException(`不支持档案版本 ${String(raw.schemaVersion ?? "unknown")}。`);
  const collectionsValue = raw.collections;
  if (!isRecord(collectionsValue)) throw new BadRequestException("archive.json 缺少 collections。");
  const collections: Record<string, ArchiveRecord[]> = {};
  for (const [name, value] of Object.entries(collectionsValue)) {
    if (!SUPPORTED_COLLECTIONS.has(name)) throw new BadRequestException(`档案包含当前版本不支持的集合：${name}。`);
    if (!Array.isArray(value) || value.some((item) => !isRecord(item))) throw new BadRequestException(`collections.${name} 必须是对象数组。`);
    collections[name] = value as ArchiveRecord[];
    for (const record of collections[name]) requireUuid(record.id, `${name}.id`);
  }
  const counts = isRecord(raw.counts) ? Object.fromEntries(Object.entries(raw.counts).map(([key, value]) => [key, number(value, `counts.${key}`)])) : {};
  for (const [name, expected] of Object.entries(counts)) {
    if (collections[name] && collections[name].length !== expected) throw new BadRequestException(`集合 ${name} 的记录数与 counts 不一致。`);
  }
  const user = isRecord(raw.user) ? raw.user : {};
  if (user.id !== undefined && (typeof user.id !== "string" || user.id.length === 0 || user.id.length > 200)) {
    throw new BadRequestException("user.id 必须是非空字符串且不能超过 200 个字符。");
  }
  const filesValue = isRecord(raw.files) ? raw.files : undefined;
  const manifest = filesValue?.manifest;
  if (manifest !== undefined && !Array.isArray(manifest)) throw new BadRequestException("files.manifest 必须是数组。");
  const missingFiles = Array.isArray(raw.missingFiles) ? raw.missingFiles.filter((item): item is string => typeof item === "string") : [];
  return {
    zip,
    archive: {
      schemaVersion: "digital-self-archive/v1",
      user: { id: stringOrUndefined(user.id), displayName: nullableString(user.displayName), timezone: nullableString(user.timezone) },
      counts,
      collections,
      files: manifest ? { manifest: manifest as ArchiveFileManifestEntry[] } : undefined,
      missingFiles,
    },
  };
}

function flattenArchive(archive: ParsedArchive, userId: string): FlatArchive {
  const source = archive.collections;
  const flat: FlatArchive = {};
  flat.evidenceArtifacts = mapTop(source.evidenceArtifacts, ["id", "artifactType", "title", "originalUri", "mimeType", "privacyLevel", "capturedAt", "createdAt"], userId);
  const revisionsWithFragments = nested(source.evidenceArtifacts, "revisions", ["id", "artifactId", "revisionNumber", "revisionType", "contentHash", "content", "storagePath", "parserVersion", "createdAt", "fragments"]);
  flat.evidenceFragments = nested(revisionsWithFragments, "fragments", ["id", "revisionId", "fragmentIndex", "content", "startOffset", "endOffset", "locator", "createdAt"]);
  flat.evidenceRevisions = revisionsWithFragments.map((item) => pick(item, ["id", "artifactId", "revisionNumber", "revisionType", "contentHash", "content", "storagePath", "parserVersion", "createdAt"]));
  flat.sourceCitations = mapTop(source.sourceCitations, ["id", "sourceType", "sourceId", "sourceVersionId", "contentHash", "title", "url", "excerpt", "locator", "metadata", "createdAt"], userId);
  flat.importedFiles = mapTop(source.importedFiles, ["id", "fileName", "fileType", "sourceType", "mimeType", "fileSizeBytes", "contentHash", "parsedText", "parseStatus", "parseError", "createdAt", "updatedAt"], userId).map((item) => ({ ...item, storagePath: null }));
  flat.dailyEntries = mapTop(source.dailyEntries, ["id", "source", "rawContent", "recordedAt", "createdAt", "updatedAt"], userId);
  flat.structuredDailyReports = nestedObject(source.dailyEntries, "structuredReport", ["id", "dailyEntryId", "facts", "emotions", "workItems", "feedback", "growthEvidence", "drainSources", "nextActions", "decisionImpact", "createdAt", "updatedAt"]);
  flat.metricRatings = nested(source.dailyEntries, "metricRatings", ["id", "dailyEntryId", "metricType", "aiScore", "userScore", "finalScore", "aiReason", "confirmedByUser", "createdAt", "updatedAt"]);
  flat.lifeDecisions = mapTop(source.lifeDecisions, ["id", "title", "description", "deadline", "status", "finalDecision", "createdAt", "updatedAt"], userId);
  flat.decisionPaths = nested(source.lifeDecisions, "paths", ["id", "decisionId", "title", "description", "benefits", "risks", "currentScore", "createdAt", "updatedAt"]);
  flat.decisionEvidence = nested(source.lifeDecisions, "evidenceItems", ["id", "decisionId", "pathId", "evidenceType", "content", "sourceCitationId", "weight", "createdAt", "updatedAt"]);
  flat.projects = mapTop(source.projects, ["id", "name", "description", "role", "startDate", "endDate", "status", "outcomes", "resumeSummary", "createdAt", "updatedAt"], userId);
  flat.abilityNodes = mapTop(source.abilityNodes, ["id", "parentId", "name", "description", "level", "origin", "createdAt", "updatedAt"], userId);
  flat.memories = mapTop(source.memories, ["id", "memoryType", "content", "sourceCitationId", "status", "confidence", "isMomentaryThought", "expiresAt", "createdAt", "updatedAt"], userId);
  flat.memoryVersions = nested(source.memories, "versions", ["id", "memoryId", "previousContent", "newContent", "changeReason", "changedBy", "createdAt"]);
  flat.memorySources = nested(source.memories, "evidenceSources", ["memoryId", "evidenceFragmentId", "role", "createdAt"]);
  flat.abilityEvidence = mapTop(source.abilityEvidence, ["id", "abilityNodeId", "sourceCitationId", "content", "impact", "difficultyScore", "independenceScore", "impactScore", "feedbackScore", "recurrenceCount", "status", "createdAt", "updatedAt"], userId);
  flat.projectAbilityEvidence = uniqueComposite(nested(source.abilityEvidence, "projects", ["projectId", "abilityEvidenceId", "linkedAt"]), ["projectId", "abilityEvidenceId"]);
  flat.events = mapTop(source.events, ["id", "dailyEntryId", "title", "description", "eventType", "occurredAt", "endedAt", "timePrecision", "recordStatus", "primarySourceCitationId", "createdAt", "updatedAt"], userId);
  flat.eventRevisions = nested(source.events, "revisions", ["id", "eventId", "revisionNumber", "title", "description", "eventType", "occurredAt", "endedAt", "timePrecision", "recordStatus", "changeReason", "changedBy", "createdAt"]);
  flat.eventSources = nested(source.events, "sources", ["eventId", "evidenceFragmentId", "role", "createdAt"]);
  flat.eventCandidates = mapTop(source.eventCandidates, ["id", "evidenceFragmentId", "title", "description", "eventType", "occurredAt", "timePrecision", "status", "confidence", "reviewedAt", "confirmedEventId", "createdAt", "updatedAt"], userId);
  flat.proposals = mapTop(source.proposals, ["id", "proposalType", "status", "title", "summary", "payload", "evidenceFragmentId", "confidence", "origin", "reviewedAt", "appliedEntityType", "appliedEntityId", "createdAt", "updatedAt"], userId);
  migrateLegacyCandidates(flat);
  flat.proposalReviews = (source.proposalReviews ?? []).map((item) => pick(item, ["id", "proposalId", "fromStatus", "toStatus", "actor", "snapshot", "note", "createdAt"]));
  flat.resumeDocuments = mapTop(source.resumeDocuments, ["id", "importedFileId", "source", "title", "content", "isPrimary", "createdAt", "updatedAt"], userId);
  flat.resumeMaterials = mapTop(source.resumeMaterials, ["id", "sourceType", "sourceId", "materialType", "content", "suggestedBullet", "status", "confidence", "createdAt", "updatedAt"], userId);
  flat.externalSources = mapTop(source.externalSources, ["id", "lifeDecisionId", "title", "sourceSite", "url", "publishedAt", "fetchedAt", "summary", "relationToDecision", "createdAt", "updatedAt"], userId);
  flat.weeklyReviews = mapTop(source.weeklyReviews, ["id", "lifeDecisionId", "periodStart", "periodEnd", "progressSummary", "abilityChanges", "emotionPatterns", "goalDrift", "nextWeekSuggestions", "lifePossibilityNotes", "createdAt", "updatedAt"], userId);
  flat.emotionPatterns = mapTop(source.emotionPatterns, ["id", "weeklyReviewId", "periodStart", "periodEnd", "dominantEmotions", "triggers", "patterns", "decisionRisk", "createdAt", "updatedAt"], userId);
  flat.graphRelations = mapTop(source.graphRelations, ["id", "sourceType", "sourceId", "targetType", "targetId", "relationType", "label", "status", "validFrom", "validTo", "evidenceFragmentId", "createdAt", "updatedAt"], userId);
  flat.people = mapTop(source.people, ["id", "name", "relationship", "description", "firstMetAt", "createdAt", "updatedAt"], userId);
  flat.eventParticipants = (source.eventParticipants ?? []).map((item) => pick(item, ["id", "eventId", "personId", "role", "description", "evidenceFragmentId", "validFrom", "validTo", "createdAt", "updatedAt"]));
  flat.goals = mapTop(source.goals, ["id", "title", "description", "area", "successCriteria", "status", "priority", "targetDate", "createdAt", "updatedAt"], userId);
  flat.futurePlans = mapTop(source.futurePlans, ["id", "goalId", "title", "description", "status", "startDate", "endDate", "createdAt", "updatedAt"], userId);
  flat.milestones = mapTop(source.milestones, ["id", "planId", "title", "description", "status", "dueAt", "completedAt", "createdAt", "updatedAt"], userId);
  flat.actionItems = mapTop(source.actionItems, ["id", "planId", "milestoneId", "title", "description", "status", "dueAt", "completedAt", "createdAt", "updatedAt"], userId);
  flat.aiSettings = mapTop(source.aiSettings, ["id", "baseUrl", "fastModel", "analysisModel", "createdAt", "updatedAt"], userId).map((item) => ({ ...item, credentialRef: null, enabled: false, externalProcessingConsentAt: null }));
  flat.aiConversations = mapTop(source.aiConversations, ["id", "title", "createdAt", "updatedAt"], userId);
  flat.aiMessages = (source.aiMessages ?? []).map((item) => pick(item, ["id", "conversationId", "role", "content", "model", "status", "errorMessage", "inputTokens", "outputTokens", "totalTokens", "latencyMs", "sourceCount", "sentCharacterCount", "citationCheckPassed", "createdAt"]));
  flat.citationUses = (source.citationUses ?? []).map((item) => pick(item, ["id", "citationId", "consumerType", "consumerId", "purpose", "createdAt"]));
  flat.toolCallLogs = mapTop(source.toolCallLogs, ["id", "agentName", "toolName", "inputSummary", "outputSummary", "status", "latencyMs", "service", "model", "sourceCount", "sentCharacterCount", "inputTokens", "outputTokens", "totalTokens", "requestId", "errorMessage", "createdAt"], userId);
  flat.reviewItemHistory = mapTop(source.reviewItemHistory, ["id", "kind", "itemId", "fromStatus", "toStatus", "snapshot", "note", "createdAt"], userId);
  validateFlatIds(flat);
  return flat;
}

function migrateLegacyCandidates(flat: FlatArchive): void {
  const proposalIds = new Set(flat.proposals.map((item) => String(item.id)));
  for (const item of flat.eventCandidates) {
    if (proposalIds.has(String(item.id))) continue;
    flat.proposals.push({
      id: item.id,
      userId: item.userId,
      proposalType: "event",
      status: item.status,
      title: item.title,
      summary: item.description ?? null,
      payload: { eventType: item.eventType, occurredAt: item.occurredAt, timePrecision: item.timePrecision, description: item.description ?? null },
      evidenceFragmentId: item.evidenceFragmentId,
      confidence: item.confidence,
      origin: "migration",
      reviewedAt: item.reviewedAt,
      appliedEntityType: item.confirmedEventId ? "event" : null,
      appliedEntityId: item.confirmedEventId ?? null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  }
}

async function prepareFiles(zip: JSZip, archive: ParsedArchive, flat: FlatArchive, userId: string, storageRoot: string, quarantine: string): Promise<PreparedFile[]> {
  const revisions = new Map(flat.evidenceRevisions.map((item) => [String(item.id), item]));
  const artifacts = new Set(flat.evidenceArtifacts.map((item) => String(item.id)));
  const manifest = archive.files?.manifest?.length ? archive.files.manifest : deriveLegacyManifest(zip, flat);
  const prepared: PreparedFile[] = [];
  const targets = new Set<string>();
  const seenRevisionIds = new Set<string>();
  for (const raw of manifest) {
    const item = validateManifestEntry(raw);
    const revision = revisions.get(item.revisionId);
    if (!revision || revision.artifactId !== item.artifactId || revision.revisionType !== "original" || !artifacts.has(item.artifactId)) {
      throw new BadRequestException(`文件清单引用了无效的 artifact/revision：${item.archivePath}。`);
    }
    const entry = zip.file(item.archivePath);
    if (!entry) { archive.missingFiles.push(item.archivePath); continue; }
    const buffer = await entry.async("nodebuffer");
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    if (buffer.length !== item.size || sha256 !== item.sha256) throw new BadRequestException(`文件 ${item.archivePath} 的大小或 SHA-256 不匹配。`);
    if (typeof revision.contentHash === "string" && revision.contentHash !== sha256) throw new BadRequestException(`文件 ${item.archivePath} 与归档 revision 哈希不一致。`);
    const filename = path.basename(item.archivePath);
    const relativeStoragePath = path.relative(process.cwd(), path.join(storageRoot, "evidence", userId, item.artifactId, filename));
    const finalKey = `${item.artifactId}/${filename}`;
    if (targets.has(finalKey) || seenRevisionIds.has(item.revisionId)) throw new BadRequestException("文件清单包含重复目标或重复 revision。");
    targets.add(finalKey); seenRevisionIds.add(item.revisionId);
    const stagedPath = path.join(quarantine, item.artifactId, filename);
    await mkdir(path.dirname(stagedPath), { recursive: true });
    await writeFile(stagedPath, buffer, { flag: "wx" });
    prepared.push({ ...item, buffer, relativeStoragePath, stagedPath });
  }
  for (const revision of flat.evidenceRevisions) {
    if (revision.revisionType === "original" && revision.storagePath && !seenRevisionIds.has(String(revision.id))) archive.missingFiles.push(String(revision.storagePath));
  }
  archive.missingFiles = Array.from(new Set(archive.missingFiles));
  return prepared;
}

function deriveLegacyManifest(zip: JSZip, flat: FlatArchive): ArchiveFileManifestEntry[] {
  const originalsByArtifact = new Map<string, ArchiveRecord[]>();
  for (const revision of flat.evidenceRevisions) {
    if (revision.revisionType !== "original") continue;
    const artifactId = String(revision.artifactId);
    originalsByArtifact.set(artifactId, [...(originalsByArtifact.get(artifactId) ?? []), revision]);
  }
  const result: ArchiveFileManifestEntry[] = [];
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || entry.name === "archive.json") continue;
    const parts = safeArchivePath(entry.name).split("/");
    if (parts.length !== 3 || parts[0] !== "files") throw new BadRequestException(`旧档案包含无法识别的文件路径：${entry.name}。`);
    const artifactId = parts[1];
    requireUuid(artifactId, `files/${artifactId}`);
    const candidates = originalsByArtifact.get(artifactId) ?? [];
    const revision = candidates.find((item) => path.basename(String(item.storagePath ?? "")) === parts[2]) ?? (candidates.length === 1 ? candidates[0] : undefined);
    if (!revision) throw new BadRequestException(`旧档案文件 ${entry.name} 无法对应到唯一的 original revision。`);
    result.push({ archivePath: entry.name, artifactId, revisionId: String(revision.id), sha256: String(revision.contentHash), size: zipEntrySize(entry) });
  }
  return result;
}

function applyRestoredStoragePaths(flat: FlatArchive, files: PreparedFile[]): void {
  const byRevision = new Map(files.map((item) => [item.revisionId, item.relativeStoragePath]));
  for (const revision of flat.evidenceRevisions) {
    if (revision.revisionType === "original") revision.storagePath = byRevision.get(String(revision.id)) ?? null;
  }
}

async function insertFlatArchive(tx: Prisma.TransactionClient, flat: FlatArchive, mode: ArchiveRestoreMode, results: ArchiveRestoreResult["collections"]): Promise<void> {
  const steps: Array<[string, keyof Prisma.TransactionClient]> = [
    ["evidenceArtifacts", "evidenceArtifact"], ["evidenceRevisions", "evidenceRevision"], ["evidenceFragments", "evidenceFragment"],
    ["sourceCitations", "sourceCitation"], ["importedFiles", "importedFile"], ["dailyEntries", "dailyEntry"],
    ["structuredDailyReports", "structuredDailyReport"], ["metricRatings", "metricRating"], ["lifeDecisions", "lifeDecision"],
    ["decisionPaths", "decisionPath"], ["projects", "project"], ["abilityNodes", "abilityNode"], ["memories", "memory"],
    ["memoryVersions", "memoryVersion"], ["memorySources", "memorySource"], ["abilityEvidence", "abilityEvidence"],
    ["projectAbilityEvidence", "projectAbilityEvidence"], ["decisionEvidence", "decisionEvidence"], ["events", "event"],
    ["eventRevisions", "eventRevision"], ["eventSources", "eventSource"], ["eventCandidates", "eventCandidate"],
    ["proposals", "proposal"], ["proposalReviews", "proposalReview"], ["resumeDocuments", "resumeDocument"],
    ["resumeMaterials", "resumeMaterial"], ["externalSources", "externalSource"], ["weeklyReviews", "weeklyReview"],
    ["emotionPatterns", "emotionPattern"], ["graphRelations", "graphRelation"], ["people", "person"],
    ["eventParticipants", "eventParticipant"], ["goals", "goal"], ["futurePlans", "futurePlan"],
    ["milestones", "milestone"], ["actionItems", "actionItem"], ["aiSettings", "aiSettings"],
    ["aiConversations", "aiConversation"], ["aiMessages", "aiMessage"], ["citationUses", "citationUse"],
    ["toolCallLogs", "toolCallLog"], ["reviewItemHistory", "reviewItemHistory"],
  ];
  for (const [name, delegateName] of steps) {
    const rows = flat[name] ?? [];
    if (!rows.length) { results[name] = { imported: 0, skipped: 0 }; continue; }
    const delegate = tx[delegateName] as unknown as CreateManyDelegate;
    const created = await delegate.createMany({ data: rows, skipDuplicates: mode === "merge_skip" || name === "sourceCitations" });
    results[name] = { imported: created.count, skipped: rows.length - created.count };
  }
}

async function deleteCurrentArchiveData(tx: Prisma.TransactionClient, userId: string): Promise<number> {
  const counts: number[] = [];
  const aiMessageIds = await tx.aiMessage.findMany({ where: { conversation: { userId } }, select: { id: true } });
  const ownedCitationIds = await tx.sourceCitation.findMany({ where: { userId }, select: { id: true } });
  const linkedCitationIds = await tx.sourceCitation.findMany({
    where: {
      OR: [
        { userId },
        { memories: { some: { userId } } },
        { decisionEvidenceItems: { some: { decision: { userId } } } },
        { abilityEvidenceItems: { some: { userId } } },
        { eventItems: { some: { userId } } },
      ],
    },
    select: { id: true },
  });
  counts.push((await tx.citationUse.deleteMany({ where: { OR: [{ citationId: { in: ownedCitationIds.map((item) => item.id) } }, { consumerType: "ai_message", consumerId: { in: aiMessageIds.map((item) => item.id) } }] } })).count);
  counts.push((await tx.reviewItemHistory.deleteMany({ where: { userId } })).count);
  counts.push((await tx.proposalReview.deleteMany({ where: { proposal: { userId } } })).count);
  counts.push((await tx.proposal.deleteMany({ where: { userId } })).count);
  counts.push((await tx.eventParticipant.deleteMany({ where: { event: { userId } } })).count);
  counts.push((await tx.graphRelation.deleteMany({ where: { userId } })).count);
  counts.push((await tx.actionItem.deleteMany({ where: { userId } })).count);
  counts.push((await tx.milestone.deleteMany({ where: { userId } })).count);
  counts.push((await tx.futurePlan.deleteMany({ where: { userId } })).count);
  counts.push((await tx.goal.deleteMany({ where: { userId } })).count);
  counts.push((await tx.aiConversation.deleteMany({ where: { userId } })).count);
  counts.push((await tx.aiSettings.deleteMany({ where: { userId } })).count);
  counts.push((await tx.toolCallLog.deleteMany({ where: { userId } })).count);
  counts.push((await tx.emotionPattern.deleteMany({ where: { userId } })).count);
  counts.push((await tx.weeklyReview.deleteMany({ where: { userId } })).count);
  counts.push((await tx.externalSource.deleteMany({ where: { userId } })).count);
  counts.push((await tx.resumeMaterial.deleteMany({ where: { userId } })).count);
  counts.push((await tx.resumeDocument.deleteMany({ where: { userId } })).count);
  counts.push((await tx.eventCandidate.deleteMany({ where: { userId } })).count);
  counts.push((await tx.event.deleteMany({ where: { userId } })).count);
  counts.push((await tx.memory.deleteMany({ where: { userId } })).count);
  counts.push((await tx.project.deleteMany({ where: { userId } })).count);
  counts.push((await tx.abilityEvidence.deleteMany({ where: { userId } })).count);
  counts.push((await tx.abilityNode.deleteMany({ where: { userId } })).count);
  counts.push((await tx.lifeDecision.deleteMany({ where: { userId } })).count);
  counts.push((await tx.dailyEntry.deleteMany({ where: { userId } })).count);
  counts.push((await tx.importedFile.deleteMany({ where: { userId } })).count);
  counts.push((await tx.evidenceArtifact.deleteMany({ where: { userId } })).count);
  counts.push((await tx.sourceCitation.deleteMany({ where: {
    id: { in: linkedCitationIds.map((item) => item.id) },
    memories: { none: {} },
    decisionEvidenceItems: { none: {} },
    abilityEvidenceItems: { none: {} },
    eventItems: { none: {} },
    uses: { none: {} },
  } })).count);
  counts.push((await tx.person.deleteMany({ where: { userId } })).count);
  return counts.reduce((sum, value) => sum + value, 0);
}

function validateArchiveReferences(flat: FlatArchive, mode: ArchiveRestoreMode): void {
  if (mode === "merge_skip") return;
  const refs: Array<[string, string, string, boolean]> = [
    ["evidenceRevisions", "artifactId", "evidenceArtifacts", false], ["evidenceFragments", "revisionId", "evidenceRevisions", false],
    ["structuredDailyReports", "dailyEntryId", "dailyEntries", false], ["metricRatings", "dailyEntryId", "dailyEntries", false],
    ["decisionPaths", "decisionId", "lifeDecisions", false], ["decisionEvidence", "decisionId", "lifeDecisions", false],
    ["decisionEvidence", "pathId", "decisionPaths", false], ["decisionEvidence", "sourceCitationId", "sourceCitations", true],
    ["abilityNodes", "parentId", "abilityNodes", true], ["memories", "sourceCitationId", "sourceCitations", true],
    ["memoryVersions", "memoryId", "memories", false], ["memorySources", "memoryId", "memories", false],
    ["memorySources", "evidenceFragmentId", "evidenceFragments", false], ["abilityEvidence", "abilityNodeId", "abilityNodes", false],
    ["abilityEvidence", "sourceCitationId", "sourceCitations", true], ["projectAbilityEvidence", "projectId", "projects", false],
    ["projectAbilityEvidence", "abilityEvidenceId", "abilityEvidence", false], ["events", "dailyEntryId", "dailyEntries", true],
    ["events", "primarySourceCitationId", "sourceCitations", true], ["eventRevisions", "eventId", "events", false],
    ["eventSources", "eventId", "events", false], ["eventSources", "evidenceFragmentId", "evidenceFragments", false],
    ["eventCandidates", "evidenceFragmentId", "evidenceFragments", false], ["eventCandidates", "confirmedEventId", "events", true],
    ["proposals", "evidenceFragmentId", "evidenceFragments", true], ["proposalReviews", "proposalId", "proposals", false],
    ["resumeDocuments", "importedFileId", "importedFiles", true], ["externalSources", "lifeDecisionId", "lifeDecisions", true],
    ["weeklyReviews", "lifeDecisionId", "lifeDecisions", true], ["emotionPatterns", "weeklyReviewId", "weeklyReviews", true],
    ["graphRelations", "evidenceFragmentId", "evidenceFragments", true], ["eventParticipants", "eventId", "events", false],
    ["eventParticipants", "personId", "people", false], ["eventParticipants", "evidenceFragmentId", "evidenceFragments", true],
    ["futurePlans", "goalId", "goals", false], ["milestones", "planId", "futurePlans", false],
    ["actionItems", "planId", "futurePlans", false], ["actionItems", "milestoneId", "milestones", true],
    ["aiMessages", "conversationId", "aiConversations", false], ["citationUses", "citationId", "sourceCitations", false],
  ];
  for (const [from, field, target, nullable] of refs) {
    const targetIds = new Set((flat[target] ?? []).map((item) => String(item.id)));
    for (const item of flat[from] ?? []) {
      const value = item[field];
      if ((value === null || value === undefined) && nullable) continue;
      if (typeof value !== "string" || !targetIds.has(value)) throw new BadRequestException(`${from}.${field} 引用了档案中不存在的 ${target} 记录。`);
    }
  }
}

function validateManifestEntry(value: ArchiveFileManifestEntry): ArchiveFileManifestEntry {
  if (!isRecord(value)) throw new BadRequestException("文件清单条目结构不正确。");
  const archivePath = safeArchivePath(String(value.archivePath ?? ""));
  if (!archivePath.startsWith("files/")) throw new BadRequestException("文件清单路径必须位于 files/ 下。");
  const artifactId = requireUuid(value.artifactId, "manifest.artifactId");
  const revisionId = requireUuid(value.revisionId, "manifest.revisionId");
  const sha256 = typeof value.sha256 === "string" && /^[0-9a-f]{64}$/i.test(value.sha256) ? value.sha256.toLowerCase() : invalid("manifest.sha256 无效。");
  const size = number(value.size, "manifest.size");
  if (!Number.isInteger(size) || size < 0 || size > MAX_ENTRY_BYTES) throw new BadRequestException("manifest.size 无效或超过上限。");
  return { archivePath, artifactId, revisionId, sha256, size };
}

function validateZipEntry(entry: JSZip.JSZipObject): void {
  safeArchivePath(entry.dir ? (entry.unsafeOriginalName ?? entry.name).replace(/\/$/, "") : entry.unsafeOriginalName ?? entry.name);
  const unixPermissions = typeof entry.unixPermissions === "number" ? entry.unixPermissions : 0;
  if ((unixPermissions & 0o170000) === 0o120000) throw new BadRequestException(`档案条目 ${entry.name} 是符号链接，不允许恢复。`);
  if (!entry.dir && entry.name !== "archive.json" && !entry.name.startsWith("files/")) throw new BadRequestException(`档案包含不支持的条目：${entry.name}。`);
}

function safeArchivePath(value: string): string {
  if (!value || value.includes("\\") || value.includes("\0") || path.posix.isAbsolute(value)) throw new BadRequestException("档案包含不安全的文件路径。");
  const parts = value.split("/");
  if (parts.some((part) => part === ".." || part === "." || part === "")) throw new BadRequestException("档案包含路径穿越或无效路径。");
  return value;
}

function zipEntrySize(entry: JSZip.JSZipObject): number {
  return Number((entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0);
}

function mapTop(records: ArchiveRecord[] | undefined, fields: string[], userId: string): ArchiveRecord[] {
  return (records ?? []).map((item) => ({ ...pick(item, fields), userId }));
}

function nested(records: ArchiveRecord[] | undefined, field: string, fields: string[]): ArchiveRecord[] {
  return (records ?? []).flatMap((item) => Array.isArray(item[field]) ? (item[field] as unknown[]).filter(isRecord).map((value) => pick(value, fields)) : []);
}

function nestedObject(records: ArchiveRecord[] | undefined, field: string, fields: string[]): ArchiveRecord[] {
  return (records ?? []).flatMap((item) => isRecord(item[field]) ? [pick(item[field] as ArchiveRecord, fields)] : []);
}

function pick(record: ArchiveRecord, fields: string[]): ArchiveRecord {
  return Object.fromEntries(fields.filter((field) => record[field] !== undefined).map((field) => [field, record[field]]));
}

function uniqueComposite(records: ArchiveRecord[], fields: string[]): ArchiveRecord[] {
  const seen = new Set<string>();
  return records.filter((item) => { const key = fields.map((field) => String(item[field])).join(":"); if (seen.has(key)) return false; seen.add(key); return true; });
}

function validateFlatIds(flat: FlatArchive): void {
  for (const [name, records] of Object.entries(flat)) {
    for (const record of records) {
      if (record.id !== undefined) requireUuid(record.id, `${name}.id`);
    }
  }
}

function restoreDatabaseError(error: unknown): BadRequestException {
  if (error instanceof BadRequestException) return error;
  const message = error instanceof Error ? error.message : "未知数据库错误";
  const safe = message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[数据库连接已隐藏]").slice(0, 800);
  return new BadRequestException(`档案数据库恢复失败，已回滚：${safe}`);
}

function assertWithin(candidate: string, root: string, message: string): void {
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) throw new BadRequestException(message);
}

async function exists(candidate: string): Promise<boolean> { try { await access(candidate); return true; } catch { return false; } }
function isRecord(value: unknown): value is ArchiveRecord { return typeof value === "object" && value !== null && !Array.isArray(value); }
function requireUuid(value: unknown, label: string): string { if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new BadRequestException(`${label} 必须是 UUID。`); return value; }
function number(value: unknown, label: string): number { if (typeof value !== "number" || !Number.isFinite(value)) throw new BadRequestException(`${label} 必须是数字。`); return value; }
function stringOrUndefined(value: unknown): string | undefined { return typeof value === "string" ? value : undefined; }
function nullableString(value: unknown): string | null | undefined { return value === null || typeof value === "string" ? value : undefined; }
function invalid(message: string): never { throw new BadRequestException(message); }
