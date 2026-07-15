#!/usr/bin/env node

import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { createIsolatedVerificationEnvironment } from "./lib/test-database-safety.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetArgument = process.argv[2];
const targetPath = resolveTargetScript(targetArgument);
const targetName = path.basename(targetPath);
const requiresWeb = new Set([
  "verify-web-ui-smoke.mjs",
  "verify-home-states.mjs",
  "verify-archive-ui.mjs",
  "verify-data-control-ui.mjs",
  "verify-graph-relations-ui.mjs",
  "verify-people-ui.mjs",
  "verify-event-participants-ui.mjs",
  "verify-planning-ui.mjs",
  "verify-ai-assistant-ui.mjs",
  "verify-review-items-ui.mjs",
]).has(targetName);
const baseEnvironment = createIsolatedVerificationEnvironment(process.env);

let apiProcess = null;
let webProcess = null;

try {
  if (process.env.VERIFY_MANAGED_API === "1") {
    await run(process.execPath, [targetPath], baseEnvironment);
    process.exit(0);
  }

  await run("corepack", ["pnpm", "build:api"], baseEnvironment);
  await run("corepack", ["pnpm", "db:migrate:deploy"], baseEnvironment);

  const apiPort = await findAvailablePort();
  const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
  const webPort = requiresWeb ? await findAvailablePort() : null;
  const webBaseUrl = webPort ? `http://127.0.0.1:${webPort}` : null;
  const verificationEnvironment = withApiBaseUrls(baseEnvironment, apiBaseUrl);

  apiProcess = spawn(process.execPath, ["--env-file=.env", "apps/api/dist/main.js"], {
    cwd: rootDir,
    env: {
      ...verificationEnvironment,
      API_HOST: "127.0.0.1",
      PORT: String(apiPort),
      ...(webBaseUrl ? { CORS_ALLOWED_ORIGINS: webBaseUrl } : {}),
      STRUCTURED_REPORT_GENERATOR_PROVIDER: "fake",
      EXTERNAL_SOURCE_SEARCH_PROVIDER: "fake",
      AI_ASSISTANT_PROVIDER: "fake",
      AI_PROVIDER_API_KEY: "test-only-ai-key-do-not-store",
    },
    stdio: "inherit",
  });
  await waitForUrl(`${apiBaseUrl}/api/health`, "API");

  if (requiresWeb && webPort && webBaseUrl) {
    await run("corepack", ["pnpm", "--filter", "digital-self-web", "build"], {
      ...verificationEnvironment,
      NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
    });
    webProcess = spawn(
      "corepack",
      ["pnpm", "--dir", "apps/web", "exec", "next", "start", "-p", String(webPort), "-H", "127.0.0.1"],
      {
        cwd: rootDir,
        env: verificationEnvironment,
        stdio: "inherit",
      },
    );
    await waitForUrl(webBaseUrl, "Web");
    verificationEnvironment.WEB_BASE_URL = webBaseUrl;
    verificationEnvironment.WEB_UI_SMOKE_WEB_BASE_URL = webBaseUrl;
  }

  await run(process.execPath, [targetPath], verificationEnvironment);
} catch (error) {
  console.error(`[verify:isolated] FAIL ${formatError(error)}`);
  process.exitCode = 1;
} finally {
  await stopProcess(webProcess);
  await stopProcess(apiProcess);
}

function resolveTargetScript(argument) {
  if (!argument) {
    throw new Error("Pass a verification script path, for example ./scripts/verify-daily-entry-api.mjs.");
  }
  const resolved = path.resolve(rootDir, argument);
  const scriptsDir = path.resolve(rootDir, "scripts");
  if (!resolved.startsWith(`${scriptsDir}${path.sep}`) || !/^verify-.+\.mjs$/.test(path.basename(resolved))) {
    throw new Error("The isolated runner only accepts verify-*.mjs files inside scripts/.");
  }
  return resolved;
}

function withApiBaseUrls(environment, apiBaseUrl) {
  const result = {
    ...environment,
    API_BASE_URL: apiBaseUrl,
    DIGITAL_SELF_API_BASE_URL: apiBaseUrl,
    NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
  };
  for (const key of Object.keys(environment)) {
    if (key.endsWith("_API_BASE_URL")) result[key] = apiBaseUrl;
  }
  return result;
}

async function run(command, args, environment) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env: environment,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`${command} ${args.join(" ")} exited with ${signal ?? code ?? "unknown"}.`));
    });
  });
}

async function findAvailablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not allocate a local port.");
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function waitForUrl(url, label) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) return;
    } catch {
      // The process is still starting.
    }
    await delay(400);
  }
  throw new Error(`${label} did not become reachable within 30 seconds.`);
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.killed) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(5_000).then(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
    }),
  ]);
}

function formatError(error) {
  return error instanceof Error ? error.stack ?? error.message : String(error);
}
