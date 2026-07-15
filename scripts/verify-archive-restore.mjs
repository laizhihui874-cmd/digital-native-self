#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";

assertIsolatedVerificationRuntime();
const baseUrl = (process.env.API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/+$/, "");
const apiRequire = createRequire(new URL("../apps/api/package.json", import.meta.url));
const { PrismaClient } = apiRequire("@prisma/client");
const JSZip = apiRequire("jszip");
const prisma = new PrismaClient();
const stamp = `restore-${Date.now()}`;

try {
  const fileBytes = Buffer.from(`${stamp}\n文件恢复哈希验收\n`, "utf8");
  const uploaded = await uploadEvidence(fileBytes, `${stamp}.txt`);
  await jsonRequest("/api/memories", {
    method: "POST",
    body: { memoryType: "event", content: `${stamp} 恢复事务验收记忆`, status: "candidate", confidence: 0.91 },
  });
  await jsonRequest("/api/ai/settings", {
    method: "PUT",
    body: { baseUrl: "https://models.example.test/v1", fastModel: "fake-fast", analysisModel: "fake-analysis", enabled: true, externalProcessingConsent: true },
  });

  const originalZip = await downloadZip();
  const original = await readArchive(originalZip);
  assert.ok(original.archive.files.manifest.length >= 1, "ZIP must contain a file manifest");
  const manifest = original.archive.files.manifest.find((item) => item.artifactId === uploaded.id);
  assert.ok(manifest, "uploaded file must be listed in the manifest");
  const uploadedFragmentId = original.archive.collections.evidenceArtifacts
    .find((item) => item.id === uploaded.id)?.revisions.flatMap((revision) => revision.fragments ?? [])[0]?.id;
  assert.ok(uploadedFragmentId, "uploaded file must have a parsed evidence fragment");
  assert.equal(manifest.sha256, sha256(fileBytes));
  assert.equal(manifest.size, fileBytes.length);
  const expectedCounts = original.archive.counts;

  const replaced = await restore(originalZip, "replace_all", "替换我的全部档案");
  assert.ok(replaced.imported > 0);
  assert.ok(replaced.replaced > 0);
  assert.equal(replaced.failed, 0);
  assert.ok(replaced.backupPath?.includes("digital_self_pre_restore_"));
  await assertArchiveCounts(expectedCounts);
  await assertRestoredFile(manifest, fileBytes);
  const restoredSettings = await prisma.aiSettings.findFirst();
  assert.equal(restoredSettings?.enabled, false);
  assert.equal(restoredSettings?.credentialRef, null);
  assert.equal(restoredSettings?.baseUrl, "https://models.example.test/v1");

  const merge = await restore(originalZip, "merge_skip");
  assert.equal(merge.imported, 0);
  assert.ok(merge.skipped > 0);
  await assertArchiveCounts(expectedCounts);

  const legacyZip = await mutateZip(originalZip, (archive) => { delete archive.files.manifest; });
  const legacy = await restore(legacyZip, "replace_all", "替换我的全部档案");
  assert.equal(legacy.failed, 0);
  await assertArchiveCounts(expectedCounts);
  await assertRestoredFile(manifest, fileBytes);

  const beforeInvalid = await currentState();
  const corruptZip = await mutateZip(originalZip, undefined, (zip) => zip.file(manifest.archivePath, Buffer.from("damaged")));
  await restoreError(corruptZip, "merge_skip", /SHA-256|大小/);
  assert.deepEqual(await currentState(), beforeInvalid);

  const missingZip = await mutateZip(originalZip, undefined, (zip) => zip.remove(manifest.archivePath));
  const missing = await restore(missingZip, "merge_skip");
  assert.ok(missing.missingFiles.includes(manifest.archivePath));
  assert.deepEqual(await currentState(), beforeInvalid);

  const traversal = new JSZip();
  traversal.file("archive.json", JSON.stringify(original.archive));
  traversal.file("../outside.txt", "no");
  await restoreError(await traversal.generateAsync({ type: "nodebuffer" }), "merge_skip", /路径|条目/);
  assert.deepEqual(await currentState(), beforeInvalid);

  const invalidEnumZip = await mutateZip(originalZip, (archive) => {
    assert.ok(archive.collections.memories.length > 0);
    archive.collections.memories[0].status = "invalid_status";
  });
  await restoreError(invalidEnumZip, "replace_all", /已回滚|status|MemoryStatus/);
  assert.deepEqual(await currentState(), beforeInvalid, "failed replace must roll back rows and files");
  await assertRestoredFile(manifest, fileBytes);

  const mappedUserId = randomUUID();
  const oldCandidateId = randomUUID();
  const legacyCandidateIds = new Set(original.archive.collections.eventCandidates.map((item) => item.id));
  const precedenceId = original.archive.collections.proposals.find((item) => !legacyCandidateIds.has(item.id))?.id;
  const compatibleZip = await mutateZip(originalZip, (archive) => {
    archive.user.id = mappedUserId;
    archive.user.displayName = `${stamp} restored user`;
    archive.collections.eventCandidates.push({
      id: oldCandidateId,
      userId: mappedUserId,
      evidenceFragmentId: uploadedFragmentId,
      title: `${stamp} 旧候选迁移`,
      description: "legacy candidate",
      eventType: "other",
      occurredAt: new Date().toISOString(),
      timePrecision: "day",
      status: "candidate",
      confidence: 0.5,
      reviewedAt: null,
      confirmedEventId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (precedenceId) {
      archive.collections.eventCandidates.push({
        ...archive.collections.eventCandidates.at(-1),
        id: precedenceId,
        title: `${stamp} 不应覆盖 Proposal`,
      });
    }
    archive.counts.eventCandidates = archive.collections.eventCandidates.length;
  });
  const compatible = await restore(compatibleZip, "replace_all", "替换我的全部档案");
  assert.equal(compatible.failed, 0);
  const currentArchive = await jsonRequest("/api/data-control/archive-export");
  const migratedProposal = await prisma.proposal.findUnique({ where: { id: oldCandidateId } });
  assert.equal(migratedProposal?.userId, currentArchive.user.id);
  assert.equal(migratedProposal?.title, `${stamp} 旧候选迁移`);
  if (precedenceId) {
    const preserved = await prisma.proposal.findUnique({ where: { id: precedenceId } });
    assert.notEqual(preserved?.title, `${stamp} 不应覆盖 Proposal`);
  }

  console.log("PASS archive replace/merge, new/legacy ZIP, user mapping, Proposal compatibility, hashes, path safety, missing files and rollback verification completed");
} finally {
  await prisma.$disconnect();
}

async function uploadEvidence(buffer, name) {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "text/plain" }), name);
  const response = await fetch(`${baseUrl}/api/evidence/artifacts/file`, { method: "POST", body: form, signal: AbortSignal.timeout(20_000) });
  const payload = await response.json();
  assert.equal(response.ok, true, JSON.stringify(payload));
  return payload.data;
}

async function downloadZip() {
  const response = await fetch(`${baseUrl}/api/data-control/archive-export.zip`, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) assert.fail(await response.text());
  return Buffer.from(await response.arrayBuffer());
}

async function readArchive(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  return { zip, archive: JSON.parse(await zip.file("archive.json").async("string")) };
}

async function mutateZip(buffer, mutateArchive, mutateFiles) {
  const { zip, archive } = await readArchive(buffer);
  mutateArchive?.(archive);
  mutateFiles?.(zip);
  zip.file("archive.json", JSON.stringify(archive));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function restore(buffer, mode, confirmationText) {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "application/zip" }), "archive.zip");
  form.append("mode", mode);
  if (confirmationText) form.append("confirmationText", confirmationText);
  const response = await fetch(`${baseUrl}/api/data-control/restore`, { method: "POST", body: form, signal: AbortSignal.timeout(120_000) });
  const payload = await response.json();
  assert.equal(response.ok, true, JSON.stringify(payload));
  return payload.data;
}

async function restoreError(buffer, mode, pattern) {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "application/zip" }), "archive.zip");
  form.append("mode", mode);
  if (mode === "replace_all") form.append("confirmationText", "替换我的全部档案");
  const response = await fetch(`${baseUrl}/api/data-control/restore`, { method: "POST", body: form, signal: AbortSignal.timeout(120_000) });
  const payload = await response.json();
  assert.equal(response.ok, false, JSON.stringify(payload));
  assert.match(payload.error?.message ?? JSON.stringify(payload), pattern);
}

async function assertArchiveCounts(expected) {
  const archive = await jsonRequest("/api/data-control/archive-export");
  assert.deepEqual(archive.counts, expected, "every exported collection count must match after restore");
}

async function assertRestoredFile(manifest, expectedBuffer) {
  const revision = await prisma.evidenceRevision.findUnique({ where: { id: manifest.revisionId } });
  assert.ok(revision?.storagePath);
  const buffer = await readFile(revision.storagePath);
  assert.equal(sha256(buffer), manifest.sha256);
  assert.deepEqual(buffer, expectedBuffer);
}

async function currentState() {
  const archive = await jsonRequest("/api/data-control/archive-export");
  const revisions = await prisma.evidenceRevision.findMany({ where: { storagePath: { not: null } }, orderBy: { id: "asc" } });
  const hashes = [];
  for (const revision of revisions) hashes.push([revision.id, sha256(await readFile(revision.storagePath))]);
  return { counts: archive.counts, userId: archive.user.id, hashes };
}

async function jsonRequest(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? "GET",
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json();
  assert.equal(response.ok, true, JSON.stringify(payload));
  return payload.data;
}

function sha256(buffer) { return createHash("sha256").update(buffer).digest("hex"); }
