#!/usr/bin/env node

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";
assertIsolatedVerificationRuntime();

import assert from "node:assert/strict";
import { createRequire } from "node:module";

const baseUrl = (process.env.API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/+$/, "");
const require = createRequire(import.meta.url);
const apiRequire = createRequire(new URL("../apps/api/package.json", import.meta.url));
const JSZip = apiRequire("jszip");
const policy = require("../apps/api/dist/data-control/external-processing-policy.js");
const previousPermission = process.env.ALLOW_EXTERNAL_PROCESSING;
delete process.env.ALLOW_EXTERNAL_PROCESSING;
assert.equal(policy.isExternalProcessingExplicitlyAllowed(), false);
assert.throws(() => policy.assertExternalProcessingAllowed("verification"), (error) => error?.status === 403);
process.env.ALLOW_EXTERNAL_PROCESSING = "1";
assert.equal(policy.isExternalProcessingExplicitlyAllowed(), true);
if (previousPermission === undefined) delete process.env.ALLOW_EXTERNAL_PROCESSING;
else process.env.ALLOW_EXTERNAL_PROCESSING = previousPermission;

const stamp = new Date().toISOString();
const artifact = await request("/api/evidence/artifacts/text", {
  method: "POST",
  body: { title: `导出验收 ${stamp}`, content: `这条资料用于验证个人档案导出。${stamp}` },
});
const uploadForm = new FormData();
uploadForm.set("file", new Blob([`打包导出原件 ${stamp}`], { type: "text/plain" }), "bundle-source.txt");
const uploadResponse = await fetch(`${baseUrl}/api/evidence/artifacts/file`, { method: "POST", body: uploadForm });
const uploadPayload = await uploadResponse.json();
assert.equal(uploadResponse.ok, true, JSON.stringify(uploadPayload));
const uploadedArtifact = uploadPayload.data;

const overview = await request("/api/data-control");
assert.equal(overview.accessMode, "local_loopback_only");
assert.equal(overview.externalProcessingExplicitlyAllowed, false);
assert.equal(overview.capabilities.find((item) => item.id === "file_parsing")?.processingLocation, "local");
assert.equal(overview.capabilities.find((item) => item.id === "memory_search")?.sendsPersonalContent, false);

const archive = await request("/api/data-control/archive-export");
assert.equal(archive.schemaVersion, "digital-self-archive/v1");
assert.equal(archive.files.rawFilesIncluded, false);
assert.equal(archive.counts.evidenceArtifacts, archive.collections.evidenceArtifacts.length);
assert.ok(archive.collections.evidenceArtifacts.some((item) => item.id === artifact.id));
assert.ok(archive.collections.evidenceArtifacts.find((item) => item.id === artifact.id).revisions[0].fragments.length > 0);

const bundleResponse = await fetch(`${baseUrl}/api/data-control/archive-export.zip`);
assert.equal(bundleResponse.ok, true);
assert.match(bundleResponse.headers.get("content-type") ?? "", /application\/zip/);
const bundleBuffer = Buffer.from(await bundleResponse.arrayBuffer());
const zip = await JSZip.loadAsync(bundleBuffer);
const bundledArchive = JSON.parse(await zip.file("archive.json").async("string"));
assert.equal(bundledArchive.files.rawFilesIncluded, true);
assert.ok(Object.keys(zip.files).some((name) => name.startsWith(`files/${uploadedArtifact.id}/original`)));

const previewForm = new FormData();
previewForm.set("file", new Blob([bundleBuffer], { type: "application/zip" }), "archive.zip");
const previewResponse = await fetch(`${baseUrl}/api/data-control/restore-preview`, { method: "POST", body: previewForm });
const previewPayload = await previewResponse.json();
assert.equal(previewResponse.ok, true, JSON.stringify(previewPayload));
assert.equal(previewPayload.data.schemaVersion, "digital-self-archive/v1");
assert.equal(previewPayload.data.supported, true);
assert.equal(previewPayload.data.collectionCounts.evidenceArtifacts, bundledArchive.collections.evidenceArtifacts.length);
assert.ok(previewPayload.data.conflictCount > 0);
assert.equal(previewPayload.data.canRestoreToEmptyDatabase, false);

const invalidForm = new FormData();
invalidForm.set("file", new Blob(["not a zip"], { type: "application/zip" }), "invalid.zip");
const invalidResponse = await fetch(`${baseUrl}/api/data-control/restore-preview`, { method: "POST", body: invalidForm });
assert.equal(invalidResponse.status, 400);

console.log("PASS Data control policy, archive export and restore preview verification completed");

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json();
  assert.equal(response.status >= 200 && response.status < 300, true, JSON.stringify(payload));
  assert.equal(payload.error, null);
  return payload.data;
}
