#!/usr/bin/env node

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";
assertIsolatedVerificationRuntime();

import assert from "node:assert/strict";

const DEFAULT_BASE_URL = "http://localhost:3001";
const REQUEST_TIMEOUT_MS = 10_000;
const LIST_PAGE_LIMIT = 100;

const baseUrl = normalizeBaseUrl(process.env.DAILY_ENTRY_API_BASE_URL ?? process.env.API_BASE_URL ?? DEFAULT_BASE_URL);
const createdRawContent = `verify-daily-entry ${new Date().toISOString()}`;

try {
  logStep(`Using base URL: ${baseUrl}`);

  const createdResponse = await requestJson("/api/daily-entries", {
    method: "POST",
    body: {
      rawContent: createdRawContent,
    },
  });
  const createdEntry = expectSuccessEnvelope(createdResponse, "POST /api/daily-entries");

  assert.equal(createdEntry.rawContent, createdRawContent, "created rawContent should match request payload");
  assert.equal(createdEntry.source, "web", "created entry source should default to 'web'");
  assert.equal(typeof createdEntry.id, "string", "created entry id should be a string");
  logPass(`POST /api/daily-entries returned id=${createdEntry.id} and source=web`);

  const fetchedResponse = await requestJson(`/api/daily-entries/${createdEntry.id}`);
  const fetchedEntry = expectSuccessEnvelope(fetchedResponse, `GET /api/daily-entries/${createdEntry.id}`);

  assert.equal(fetchedEntry.id, createdEntry.id, "fetched entry id should match created entry id");
  logPass(`GET /api/daily-entries/:id returned the same id=${fetchedEntry.id}`);

  const createdEntryFromList = await findEntryInListByRecordedAt(createdEntry.id, fetchedEntry.recordedAt);
  assert.equal(createdEntryFromList.id, createdEntry.id, "list entry id should match created entry id");
  logPass("GET /api/daily-entries validated pagination fields and included the created entry");

  logPass("DailyEntry API verification completed");
} catch (error) {
  logFail(formatError(error));
  process.exit(1);
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

async function findEntryInListByRecordedAt(entryId, recordedAt) {
  let offset = 0;

  while (true) {
    const pathname = buildDailyEntriesListPath({
      limit: LIST_PAGE_LIMIT,
      offset,
      from: recordedAt,
      to: recordedAt,
    });
    const listResponse = await requestJson(pathname);
    const listPayload = expectSuccessEnvelope(listResponse, `GET ${pathname}`);

    assert.ok(listPayload && typeof listPayload === "object", "list payload should be an object");
    assert.ok(Array.isArray(listPayload.items), "list payload should contain items array");
    assert.ok(
      listPayload.pagination && typeof listPayload.pagination === "object",
      "list payload should contain pagination object",
    );
    assert.deepEqual(
      Object.keys(listPayload.pagination).sort(),
      ["limit", "offset", "total"],
      "pagination should contain only limit, offset, total",
    );
    assert.equal(listPayload.pagination.limit, LIST_PAGE_LIMIT, "pagination.limit should equal requested limit");
    assert.equal(listPayload.pagination.offset, offset, "pagination.offset should equal requested offset");
    assert.equal(typeof listPayload.pagination.total, "number", "pagination.total should be a number");

    const matchedEntry = listPayload.items.find((item) => item.id === entryId);
    if (matchedEntry) {
      return matchedEntry;
    }

    const nextOffset = offset + listPayload.items.length;
    if (listPayload.items.length === 0 || nextOffset >= listPayload.pagination.total) {
      break;
    }

    offset = nextOffset;
  }

  throw new assert.AssertionError({
    message: `list payload should include created entry ${entryId} when filtered by recordedAt=${recordedAt}`,
  });
}

function buildDailyEntriesListPath({ limit, offset, from, to }) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  if (from) {
    params.set("from", from);
  }

  if (to) {
    params.set("to", to);
  }

  return `/api/daily-entries?${params.toString()}`;
}

async function requestJson(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const rawText = await response.text();
  const payload = rawText ? safeJsonParse(rawText) : null;

  if (!response.ok) {
    throw new Error(
      `${options.method ?? "GET"} ${pathname} failed with ${response.status} ${response.statusText}: ${rawText || "<empty body>"}`,
    );
  }

  return payload;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
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

function formatError(error) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

function logStep(message) {
  console.log(`[verify:daily-entry] ${message}`);
}

function logPass(message) {
  console.log(`[verify:daily-entry] PASS ${message}`);
}

function logFail(message) {
  console.error(`[verify:daily-entry] FAIL ${message}`);
}
