#!/usr/bin/env node

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";
assertIsolatedVerificationRuntime();

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { deflateRawSync } from "node:zlib";
import { setTimeout as delay } from "node:timers/promises";

const DEFAULT_BASE_URL = "http://localhost:3001";
const DEFAULT_HEALTH_PATH = "/api/health";
const REQUEST_TIMEOUT_MS = 10_000;
const SERVER_BOOT_TIMEOUT_MS = 30_000;

const baseUrl = normalizeBaseUrl(
  process.env.RESUME_DOCUMENTS_API_BASE_URL ?? process.env.API_BASE_URL ?? DEFAULT_BASE_URL,
);
const healthPath = process.env.RESUME_DOCUMENTS_HEALTH_PATH ?? DEFAULT_HEALTH_PATH;
const suffix = new Date().toISOString().replace(/[:.]/g, "-");
let crc32Table;

let serverProcess = null;

try {
  logStep(`Using base URL: ${baseUrl}`);
  serverProcess = await ensureApiServer();

  const preservedTextContent = `  核心经历 ${suffix}\n- 搭建系统\n结尾保留两个空格  `;
  const createdTextResponse = await requestJson("/api/resume-documents/text", {
    method: "POST",
    json: {
      title: `  Primary Resume ${suffix}  `,
      content: preservedTextContent,
      isPrimary: true,
    },
  });
  assertOkStatus(createdTextResponse, "POST /api/resume-documents/text");
  const createdTextDocument = expectSuccessEnvelope(
    createdTextResponse.payload,
    "POST /api/resume-documents/text",
  );

  assert.equal(createdTextDocument.title, `Primary Resume ${suffix}`, "text title should be trimmed");
  assert.equal(
    createdTextDocument.content,
    preservedTextContent,
    "text content should preserve leading and trailing whitespace",
  );
  assert.equal(createdTextDocument.isPrimary, true, "first text document should be primary");
  assert.equal(createdTextDocument.source, "pasted", "text document source should be pasted");
  assert.equal(createdTextDocument.importedFileId, null, "text document should not have importedFileId");
  logPass(`POST /api/resume-documents/text created id=${createdTextDocument.id}`);

  const createdFileResponse = await requestForm("/api/resume-documents/file", {
    method: "POST",
    fields: {
      title: `  Uploaded Resume ${suffix}  `,
      isPrimary: true,
    },
    file: {
      name: `resume-upload-${suffix}.md`,
      type: "text/markdown",
      content: `# Resume ${suffix}\n\n- shipped API verify coverage\n- preserved markdown content\n`,
    },
  });
  assertOkStatus(createdFileResponse, "POST /api/resume-documents/file");
  const createdFileDocument = expectSuccessEnvelope(
    createdFileResponse.payload,
    "POST /api/resume-documents/file",
  );

  assert.equal(createdFileDocument.title, `Uploaded Resume ${suffix}`, "file title should be trimmed");
  assert.equal(createdFileDocument.source, "uploaded", "file document source should be uploaded");
  assert.equal(createdFileDocument.isPrimary, true, "uploaded document should become primary");
  assert.equal(
    typeof createdFileDocument.importedFileId,
    "string",
    "uploaded document should expose importedFileId",
  );
  assert.notEqual(
    createdFileDocument.importedFileId.length,
    0,
    "uploaded document importedFileId should not be empty",
  );
  assert.ok(
    createdFileDocument.content.includes("shipped API verify coverage"),
    "uploaded document should expose parsed content",
  );
  logPass(`POST /api/resume-documents/file created id=${createdFileDocument.id}`);

  const listResponseAfterUpload = await requestJson("/api/resume-documents?limit=10&offset=0");
  assertOkStatus(listResponseAfterUpload, "GET /api/resume-documents after upload");
  const listedDocumentsAfterUpload = expectSuccessEnvelope(
    listResponseAfterUpload.payload,
    "GET /api/resume-documents after upload",
  );

  assert.equal(listedDocumentsAfterUpload.pagination.limit, 10, "list limit should match");
  assert.equal(listedDocumentsAfterUpload.pagination.offset, 0, "list offset should match");
  assert.ok(
    listedDocumentsAfterUpload.items.some((item) => item.id === createdTextDocument.id),
    "list should include created text document",
  );
  assert.ok(
    listedDocumentsAfterUpload.items.some((item) => item.id === createdFileDocument.id),
    "list should include created file document",
  );

  const primaryDocumentsAfterUpload = listedDocumentsAfterUpload.items.filter((item) => item.isPrimary);
  assert.equal(primaryDocumentsAfterUpload.length, 1, "list should contain exactly one primary resume");
  assert.equal(
    primaryDocumentsAfterUpload[0].id,
    createdFileDocument.id,
    "second primary upload should replace the first primary document",
  );
  logPass("GET /api/resume-documents kept a unique primary document after second create");

  const detailResponse = await requestJson(`/api/resume-documents/${createdFileDocument.id}`);
  assertOkStatus(detailResponse, "GET /api/resume-documents/:id");
  const detail = expectSuccessEnvelope(detailResponse.payload, "GET /api/resume-documents/:id");

  assert.equal(detail.id, createdFileDocument.id, "detail id should match uploaded document");
  assert.equal(detail.importedFileId, createdFileDocument.importedFileId, "detail importedFileId should match");
  assert.equal(detail.content, createdFileDocument.content, "detail content should match uploaded document");
  logPass("GET /api/resume-documents/:id returned uploaded document detail");

  const updatedTextResponse = await requestJson(`/api/resume-documents/${createdTextDocument.id}`, {
    method: "PATCH",
    json: {
      title: `  Final Primary Resume ${suffix}  `,
      isPrimary: true,
    },
  });
  assertOkStatus(updatedTextResponse, "PATCH /api/resume-documents/:id");
  const updatedTextDocument = expectSuccessEnvelope(
    updatedTextResponse.payload,
    "PATCH /api/resume-documents/:id",
  );

  assert.equal(updatedTextDocument.title, `Final Primary Resume ${suffix}`, "patched title should be trimmed");
  assert.equal(updatedTextDocument.isPrimary, true, "patched document should become primary");
  logPass("PATCH /api/resume-documents/:id updated title and isPrimary");

  const listResponseAfterPatch = await requestJson("/api/resume-documents?limit=10&offset=0");
  assertOkStatus(listResponseAfterPatch, "GET /api/resume-documents after patch");
  const listedDocumentsAfterPatch = expectSuccessEnvelope(
    listResponseAfterPatch.payload,
    "GET /api/resume-documents after patch",
  );

  const primaryDocumentsAfterPatch = listedDocumentsAfterPatch.items.filter((item) => item.isPrimary);
  assert.equal(primaryDocumentsAfterPatch.length, 1, "patched list should still contain one primary document");
  assert.equal(
    primaryDocumentsAfterPatch[0].id,
    createdTextDocument.id,
    "patched text document should become the only primary document",
  );
  logPass("PATCH preserved primary uniqueness across resume documents");

  const emptyTextResponse = await requestJson("/api/resume-documents/text", {
    method: "POST",
    json: {
      title: `empty-text-${suffix}`,
      content: "   \n\t",
    },
  });
  assert.equal(emptyTextResponse.status, 400, "empty text content should return 400");
  expectErrorEnvelope(emptyTextResponse.payload, "POST /api/resume-documents/text empty content");
  logPass("POST /api/resume-documents/text rejected empty content with 400");

  const pdfContent = `PDF resume parser coverage ${suffix}`;
  const pdfUploadResponse = await requestForm("/api/resume-documents/file", {
    method: "POST",
    fields: {
      title: `pdf-upload-${suffix}`,
    },
    file: {
      name: `resume-${suffix}.pdf`,
      type: "application/pdf",
      content: createMinimalPdf(pdfContent),
    },
  });
  assertOkStatus(pdfUploadResponse, "POST /api/resume-documents/file pdf upload");
  const pdfDocument = expectSuccessEnvelope(
    pdfUploadResponse.payload,
    "POST /api/resume-documents/file pdf upload",
  );
  assert.ok(pdfDocument.content.includes(pdfContent), "PDF upload should expose parsed text");
  assert.equal(pdfDocument.source, "uploaded", "PDF document source should be uploaded");
  logPass("POST /api/resume-documents/file parsed PDF upload");

  const docxContent = `DOCX resume parser coverage ${suffix}`;
  const docxUploadResponse = await requestForm("/api/resume-documents/file", {
    method: "POST",
    fields: {
      title: `docx-upload-${suffix}`,
    },
    file: {
      name: `resume-${suffix}.docx`,
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      content: createMinimalDocx(docxContent),
    },
  });
  assertOkStatus(docxUploadResponse, "POST /api/resume-documents/file docx upload");
  const docxDocument = expectSuccessEnvelope(
    docxUploadResponse.payload,
    "POST /api/resume-documents/file docx upload",
  );
  assert.ok(docxDocument.content.includes(docxContent), "DOCX upload should expose parsed text");
  assert.equal(docxDocument.source, "uploaded", "DOCX document source should be uploaded");
  logPass("POST /api/resume-documents/file parsed DOCX upload");

  const legacyDocUploadResponse = await requestForm("/api/resume-documents/file", {
    method: "POST",
    fields: {
      title: `legacy-doc-upload-${suffix}`,
    },
    file: {
      name: `resume-${suffix}.doc`,
      type: "application/msword",
      content: Buffer.from("legacy binary doc payload"),
    },
  });
  assert.equal(legacyDocUploadResponse.status, 422, "legacy .doc upload should return 422");
  expectErrorEnvelope(legacyDocUploadResponse.payload, "POST /api/resume-documents/file doc upload");
  logPass("POST /api/resume-documents/file reports legacy .doc parse limitation with 422");

  const deleteResponse = await requestJson(`/api/resume-documents/${createdFileDocument.id}`, {
    method: "DELETE",
  });
  assert.equal(deleteResponse.status, 204, "DELETE /api/resume-documents/:id should return 204");
  assert.equal(deleteResponse.payload, null, "delete response should not include a JSON payload");
  logPass("DELETE /api/resume-documents/:id returned 204");

  const deletedDetailResponse = await requestJson(`/api/resume-documents/${createdFileDocument.id}`);
  assert.equal(deletedDetailResponse.status, 404, "deleted resume document detail should return 404");
  expectErrorEnvelope(
    deletedDetailResponse.payload,
    "GET /api/resume-documents/:id after delete",
  );
  logPass("GET /api/resume-documents/:id returned 404 after delete");

  logPass("ResumeDocument API verification completed");
} catch (error) {
  logFail(formatError(error));
  process.exitCode = 1;
} finally {
  await stopApiServer(serverProcess);
}

async function ensureApiServer() {
  if (await isApiHealthy()) {
    logStep("Detected an existing API server");
    return null;
  }

  logStep("Starting the built API server for verification");
  const child = spawn(process.execPath, ["--env-file=.env", "apps/api/dist/main.js"], {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  const started = await waitForApiHealth();

  if (!started) {
    child.kill("SIGTERM");
    throw new Error(`API server did not become healthy within ${SERVER_BOOT_TIMEOUT_MS}ms`);
  }

  logStep("API server is healthy");
  return child;
}

async function waitForApiHealth() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < SERVER_BOOT_TIMEOUT_MS) {
    if (await isApiHealthy()) {
      return true;
    }

    await delay(500);
  }

  return false;
}

async function isApiHealthy() {
  try {
    const response = await fetch(`${baseUrl}${healthPath}`, {
      signal: AbortSignal.timeout(2_000),
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function stopApiServer(child) {
  if (!child) {
    return;
  }

  if (child.exitCode !== null || child.killed) {
    return;
  }

  child.kill("SIGTERM");

  await new Promise((resolve) => {
    child.once("exit", () => resolve(undefined));
    setTimeout(() => {
      if (child.exitCode === null && !child.killed) {
        child.kill("SIGKILL");
      }
      resolve(undefined);
    }, 5_000);
  });
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

async function requestJson(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.json ? { "content-type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
    body: options.json ? JSON.stringify(options.json) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  return {
    status: response.status,
    statusText: response.statusText,
    payload: await readJsonBody(response),
  };
}

async function requestForm(pathname, options) {
  const form = new FormData();

  for (const [key, value] of Object.entries(options.fields ?? {})) {
    if (value !== undefined && value !== null) {
      form.append(key, String(value));
    }
  }

  if (options.file) {
    form.append(
      "file",
      new Blob([options.file.content], { type: options.file.type }),
      options.file.name,
    );
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? "POST",
    body: form,
    headers: options.headers ?? {},
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  return {
    status: response.status,
    statusText: response.statusText,
    payload: await readJsonBody(response),
  };
}

async function readJsonBody(response) {
  if (response.status === 204 || response.status === 205 || response.status === 304) {
    return null;
  }

  if (response.headers.get("content-length") === "0") {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const bodyText = await response.text();
    throw new Error(
      `Expected JSON response from ${response.url}, received ${contentType || "unknown"}: ${bodyText}`,
    );
  }

  return response.json();
}

function assertOkStatus(response, label) {
  if (response.status >= 200 && response.status < 300) {
    return;
  }

  throw new Error(
    `${label} failed with ${response.status} ${response.statusText}: ${safeJsonStringify(response.payload)}`,
  );
}

function expectSuccessEnvelope(payload, label) {
  assert.ok(payload && typeof payload === "object", `${label} should return a JSON object`);
  assert.ok("data" in payload, `${label} should include data`);
  assert.ok("error" in payload, `${label} should include error`);
  assert.ok("requestId" in payload, `${label} should include requestId`);
  assert.equal(payload.error, null, `${label} should have error=null`);
  assert.equal(typeof payload.requestId, "string", `${label} requestId should be a string`);
  assert.notEqual(payload.requestId.length, 0, `${label} requestId should not be empty`);

  return payload.data;
}

function expectErrorEnvelope(payload, label) {
  assert.ok(payload && typeof payload === "object", `${label} should return a JSON object`);
  assert.ok("data" in payload, `${label} should include data`);
  assert.ok("error" in payload, `${label} should include error`);
  assert.ok("requestId" in payload, `${label} should include requestId`);
  assert.equal(payload.data, null, `${label} should have data=null`);
  assert.ok(payload.error && typeof payload.error === "object", `${label} should include error object`);
  assert.equal(typeof payload.requestId, "string", `${label} requestId should be a string`);
  assert.notEqual(payload.requestId.length, 0, `${label} requestId should not be empty`);

  return payload;
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function createMinimalPdf(text) {
  const escapedText = text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const stream = `BT\n/F1 18 Tf\n72 720 Td\n(${escapedText}) Tj\nET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];

  let body = "%PDF-1.4\n";
  const offsets = [0];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += object;
  }

  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (const offset of offsets.slice(1)) {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(body);
}

function createMinimalDocx(text) {
  return createZipArchive([
    {
      name: "[Content_Types].xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    },
    {
      name: "_rels/.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    },
    {
      name: "word/document.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p></w:body></w:document>`,
    },
  ]);
}

function createZipArchive(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name);
    const data = Buffer.from(file.content);
    const compressed = deflateRawSync(data);
    const crc = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localParts.push(localHeader, name, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + compressed.length;
  }

  const centralStart = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(files.length, 8);
  endRecord.writeUInt16LE(files.length, 10);
  endRecord.writeUInt32LE(centralSize, 12);
  endRecord.writeUInt32LE(centralStart, 16);

  return Buffer.concat([...localParts, ...centralParts, endRecord]);
}

function crc32(buffer) {
  const table = getCrc32Table();
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function getCrc32Table() {
  if (!crc32Table) {
    crc32Table = Array.from({ length: 256 }, (_, index) => {
      let value = index;

      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }

      return value >>> 0;
    });
  }

  return crc32Table;
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatError(error) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

function logStep(message) {
  console.log(`[verify:resume-documents] ${message}`);
}

function logPass(message) {
  console.log(`[verify:resume-documents] PASS ${message}`);
}

function logFail(message) {
  console.error(`[verify:resume-documents] FAIL ${message}`);
}
