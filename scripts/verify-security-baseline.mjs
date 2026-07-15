#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const DEFAULT_BASE_URL = "http://localhost:3001";
const DEFAULT_HEALTH_PATH = "/api/health";
const REQUEST_TIMEOUT_MS = 10_000;
const SERVER_BOOT_TIMEOUT_MS = 30_000;

const explicitBaseUrl = process.env.SECURITY_BASELINE_API_BASE_URL ?? process.env.API_BASE_URL;
const baseUrl = normalizeBaseUrl(explicitBaseUrl ?? DEFAULT_BASE_URL);
const healthPath = process.env.SECURITY_BASELINE_HEALTH_PATH ?? DEFAULT_HEALTH_PATH;
let serverProcess = null;

try {
  logStep(`Using base URL: ${baseUrl}`);
  serverProcess = await ensureApiServer();

  const corsResponse = await fetch(`${baseUrl}${healthPath}`, {
    headers: {
      origin: "https://untrusted.example.com",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  assert.equal(corsResponse.status, 403, "unknown CORS origin should be rejected");
  const corsPayload = await corsResponse.json();
  assert.equal(corsPayload.error.code, "Forbidden");
  assert.ok(corsPayload.requestId, "CORS rejection should still include requestId");
  logPass("CORS rejects unknown origins with requestId envelope");

  const invalidRequestId = "bad request id with spaces";
  const requestIdResponse = await fetch(`${baseUrl}${healthPath}`, {
    headers: {
      "x-request-id": invalidRequestId,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  assert.equal(requestIdResponse.status, 200, "health check with unsafe request id should still succeed");
  const returnedRequestId = requestIdResponse.headers.get("x-request-id");
  assert.ok(returnedRequestId, "response should include generated requestId");
  assert.notEqual(returnedRequestId, invalidRequestId, "unsafe inbound requestId should not be echoed");
  assert.match(returnedRequestId, /^[a-zA-Z0-9._:-]{1,128}$/);
  logPass("Unsafe inbound requestId is replaced before echoing");

  const notFoundResponse = await fetch(`${baseUrl}/api/__security_missing_route__`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  assert.equal(notFoundResponse.status, 404, "missing route should return 404");
  const notFoundPayload = await notFoundResponse.json();
  assert.equal(notFoundPayload.data, null);
  assert.ok(notFoundPayload.error.message, "404 error should include a user-safe message");
  assert.ok(notFoundPayload.requestId, "404 error should include requestId");
  logPass("404 errors use the standard envelope");

  logPass("Security baseline verification completed");
} catch (error) {
  logFail(formatError(error));
  process.exitCode = 1;
} finally {
  await stopApiServer(serverProcess);
}

async function ensureApiServer() {
  if (await isApiHealthy(baseUrl)) {
    logStep("Detected an existing API server");
    return null;
  }

  if (explicitBaseUrl) {
    throw new Error(`Explicit API base URL ${baseUrl} is not healthy.`);
  }

  const url = new URL(baseUrl);
  if (!isLocalHostname(url.hostname)) {
    throw new Error(`Cannot start a managed API server for non-local host ${baseUrl}.`);
  }

  const port = url.port ? Number(url.port) : 3001;
  if (!(await isPortAvailable(port))) {
    throw new Error(`Port ${port} is occupied but API health check failed.`);
  }

  logStep(`Starting managed API server on port ${port}`);
  const child = spawn("corepack", ["pnpm", "--filter", "@digital-self/api", "start"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      STRUCTURED_REPORT_GENERATOR_PROVIDER: "fake",
      EXTERNAL_SOURCE_SEARCH_PROVIDER: "fake",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[api] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[api] ${chunk}`);
  });

  const startedAt = Date.now();
  while (Date.now() - startedAt < SERVER_BOOT_TIMEOUT_MS) {
    if (await isApiHealthy(baseUrl)) {
      logStep("Managed API server is healthy");
      return child;
    }
    await delay(500);
  }

  await stopApiServer(child);
  throw new Error("Timed out waiting for managed API server health check.");
}

async function isApiHealthy(targetBaseUrl) {
  try {
    const response = await fetch(`${targetBaseUrl}${healthPath}`, {
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
  for (let index = 0; index < 20; index += 1) {
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }
    await delay(250);
  }
  child.kill("SIGKILL");
}

function normalizeBaseUrl(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

function formatError(error) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function logStep(message) {
  console.log(`[verify:security-baseline] ${message}`);
}

function logPass(message) {
  console.log(`[verify:security-baseline] PASS ${message}`);
}

function logFail(message) {
  console.error(`[verify:security-baseline] FAIL ${message}`);
}
