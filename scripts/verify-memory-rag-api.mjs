#!/usr/bin/env node

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";
assertIsolatedVerificationRuntime();

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const DEFAULT_BASE_URL = "http://localhost:3001";
const REQUEST_TIMEOUT_MS = 10_000;
const SERVER_BOOT_TIMEOUT_MS = 30_000;
const baseUrl = (process.env.MEMORY_RAG_API_BASE_URL ?? process.env.API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
const suffix = new Date().toISOString().replace(/[:.]/g, "-");
let serverProcess = null;

try {
  serverProcess = await ensureApiServer();

  const confirmed = await apiData("/api/memories", {
    method: "POST",
    body: {
      memoryType: "ability",
      content: `memory-rag-${suffix} 表达 沟通 判断 AI 应用项目 复盘`,
      status: "confirmed",
      confidence: 0.9,
    },
  });
  await apiData("/api/memories", {
    method: "POST",
    body: {
      memoryType: "ability",
      content: `memory-rag-${suffix} 表达 沟通 但仍是候选`,
      status: "candidate",
    },
  });

  const result = await apiData("/api/memories/search", {
    method: "POST",
    body: {
      query: `memory-rag-${suffix} 表达 沟通`,
      limit: 5,
    },
  });

  assert.equal(result.retrievalMode, "lexical");
  assert.equal(result.embeddingModel, "none");
  assert.ok(result.warning.includes("关键词检索"));
  assert.equal(result.sourceSnapshot.embeddedMemoriesCreatedOrUpdated, 0);
  assert.equal(result.sourceSnapshot.confirmedMemoriesRead >= 1, true);
  assert.ok(result.items.some((item) => item.memory.id === confirmed.id));
  assert.ok(
    result.items.every((item) => item.memory.status === "confirmed"),
    "RAG search should only return confirmed memories",
  );
  console.log("[verify:memory-rag] PASS confirmed-only lexical search works without embedding writes");
} catch (error) {
  console.error(`[verify:memory-rag] FAIL ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
} finally {
  await stopApiServer(serverProcess);
}

async function apiData(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload?.error?.message ?? `${pathname} failed with ${response.status}`);
  }
  return payload.data;
}

async function ensureApiServer() {
  if (await isApiHealthy()) {
    return null;
  }

  const child = spawn("corepack", ["pnpm", "--filter", "@digital-self/api", "start"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: new URL(baseUrl).port || "3001",
      STRUCTURED_REPORT_GENERATOR_PROVIDER: "fake",
      EXTERNAL_SOURCE_SEARCH_PROVIDER: "fake",
    },
    stdio: "ignore",
  });

  const startedAt = Date.now();
  while (Date.now() - startedAt < SERVER_BOOT_TIMEOUT_MS) {
    if (await isApiHealthy()) {
      return child;
    }
    await delay(500);
  }

  await stopApiServer(child);
  throw new Error("API server did not become healthy.");
}

async function isApiHealthy() {
  try {
    const response = await fetch(`${baseUrl}/api/health`, {
      signal: AbortSignal.timeout(2_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function stopApiServer(child) {
  if (!child || child.killed) {
    return;
  }
  child.kill("SIGTERM");
  await delay(1_000);
}
