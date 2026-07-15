#!/usr/bin/env node

import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

import { createIsolatedVerificationEnvironment } from "./lib/test-database-safety.mjs";

const DEFAULT_API_BASE_URL = "http://localhost:3001";
const DEFAULT_HEALTH_PATH = "/api/health";
const SERVER_BOOT_TIMEOUT_MS = 30_000;

const rootDir = process.cwd();
const explicitApiBaseUrl = process.env.VERIFY_ALL_API_BASE_URL ?? process.env.API_BASE_URL;
const requestedApiBaseUrl = normalizeBaseUrl(explicitApiBaseUrl ?? DEFAULT_API_BASE_URL);
const healthPath = process.env.VERIFY_ALL_HEALTH_PATH ?? DEFAULT_HEALTH_PATH;
const verifySuite = normalizeVerifySuite(process.env.VERIFY_SUITE ?? "quick");
const verificationBaseEnvironment = {
  ...(verifySuite === "full" ? createIsolatedVerificationEnvironment(process.env) : process.env),
  AI_ASSISTANT_PROVIDER: process.env.AI_ASSISTANT_PROVIDER ?? "fake",
  AI_PROVIDER_API_KEY: process.env.AI_PROVIDER_API_KEY ?? "test-only-ai-key-do-not-store",
};
let activeApiBaseUrl = requestedApiBaseUrl;

const commandPlan = [
  {
    label: "Base build/typecheck",
    cmd: "corepack",
    args: ["pnpm", "verify:base"],
    requiresApi: false,
    suites: ["quick", "full"],
  },
  {
    label: "Web build",
    cmd: "corepack",
    args: ["pnpm", "build:web"],
    requiresApi: false,
    suites: ["quick", "full"],
  },
  {
    label: "MCP build",
    cmd: "corepack",
    args: ["pnpm", "build:mcp"],
    requiresApi: false,
    suites: ["full"],
  },
  {
    label: "Deterministic agent verify",
    cmd: "corepack",
    args: ["pnpm", "verify:agent-deterministic"],
    requiresApi: false,
    suites: ["quick", "full"],
  },
  {
    label: "DailyEntry API verify",
    cmd: "corepack",
    args: ["pnpm", "verify:daily-entry"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "Evidence and event archive API verify",
    cmd: "corepack",
    args: ["pnpm", "verify:evidence-event-archive"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "Data control and archive export verify",
    cmd: "corepack",
    args: ["pnpm", "verify:data-control"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "Manual graph relations and as-of verify",
    cmd: "corepack",
    args: ["pnpm", "verify:graph-relations"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "People archive and graph verify",
    cmd: "corepack",
    args: ["pnpm", "verify:people-graph"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "Source-backed event participation verify",
    cmd: "corepack",
    args: ["pnpm", "verify:event-participants"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "Future planning hierarchy and graph verify",
    cmd: "corepack",
    args: ["pnpm", "verify:planning-graph"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "StructuredDailyReport API verify",
    cmd: "corepack",
    args: ["pnpm", "verify:structured-daily-report"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "Structured draft API verify",
    cmd: "corepack",
    args: ["pnpm", "verify:daily-entry-structured-draft"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "Structured generate API verify",
    cmd: "corepack",
    args: ["pnpm", "verify:daily-entry-structured-report-generate"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "Metric ratings API verify",
    cmd: "corepack",
    args: ["pnpm", "verify:metric-ratings"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "Memory candidates API verify",
    cmd: "corepack",
    args: ["pnpm", "verify:memory-candidates"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "Memory review API verify",
    cmd: "corepack",
    args: ["pnpm", "verify:memory-review"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "Legacy memory lexical search verify",
    cmd: "corepack",
    args: ["pnpm", "verify:memory-rag"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "Archive lexical search verify",
    cmd: "corepack",
    args: ["pnpm", "verify:archive-search"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "AI archive assistant API verify",
    cmd: "corepack",
    args: ["pnpm", "verify:ai-assistant"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "Unified proposal and review items API verify",
    cmd: "corepack",
    args: ["pnpm", "verify:review-items"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "Archive restore round-trip verify",
    cmd: "corepack",
    args: ["pnpm", "verify:archive-restore"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "macOS launcher runtime verify",
    cmd: "corepack",
    args: ["pnpm", "verify:app-runtime"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "AbilityNode API verify",
    cmd: "corepack",
    args: ["pnpm", "verify:ability-nodes"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "AbilityEvidence API verify",
    cmd: "corepack",
    args: ["pnpm", "verify:ability-evidence"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "LifeDecision API verify",
    cmd: "corepack",
    args: ["pnpm", "verify:life-decisions"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "DecisionEvidence API verify",
    cmd: "corepack",
    args: ["pnpm", "verify:decision-evidence"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "WeeklyReview API verify",
    cmd: "corepack",
    args: ["pnpm", "verify:weekly-reviews"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "ExternalSource API verify",
    cmd: "corepack",
    args: ["pnpm", "verify:external-sources"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "ExternalSource search API verify",
    cmd: "corepack",
    args: ["pnpm", "verify:external-source-search"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "ExternalSource impact draft API verify",
    cmd: "corepack",
    args: ["pnpm", "verify:external-source-impact-draft"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "Projects API verify",
    cmd: "corepack",
    args: ["pnpm", "verify:projects"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "Resume documents API verify",
    cmd: "corepack",
    args: ["pnpm", "verify:resume-documents"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "Resume materials API verify",
    cmd: "corepack",
    args: ["pnpm", "verify:resume-materials"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "Resume gap analysis API verify",
    cmd: "corepack",
    args: ["pnpm", "verify:resume-gap-analysis"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "Project packaging suggestions API verify",
    cmd: "corepack",
    args: ["pnpm", "verify:project-packaging-suggestions"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "Security baseline verify",
    cmd: "corepack",
    args: ["pnpm", "verify:security-baseline"],
    requiresApi: true,
    suites: ["full"],
  },
  {
    label: "MCP smoke",
    cmd: "corepack",
    args: ["pnpm", "--filter", "@digital-self/mcp", "smoke"],
    requiresApi: true,
    suites: [],
  },
];

let serverProcess = null;

const cleanupAndExit = async (signal) => {
  if (signal) {
    logStep(`Received ${signal}, shutting down verification runner`);
  }

  await stopApiServer(serverProcess);
  process.exit(signal ? 130 : process.exitCode ?? 0);
};

process.on("SIGINT", () => {
  void cleanupAndExit("SIGINT");
});
process.on("SIGTERM", () => {
  void cleanupAndExit("SIGTERM");
});

try {
  logStep(`Requested API base URL: ${requestedApiBaseUrl}`);
  logStep(`Verification suite: ${verifySuite}`);

  const selectedCommands = commandPlan.filter((command) =>
    command.suites.includes(verifySuite),
  );
  const setupCommands = selectedCommands.filter((command) => !command.requiresApi);
  const apiCommands = selectedCommands.filter((command) => command.requiresApi);

  for (const command of setupCommands) {
    await runCommand(command, {
      env:
        command.label === "Web build"
          ? { ...process.env, NODE_ENV: "production" }
          : process.env,
    });
  }

  if (apiCommands.length > 0) {
    serverProcess = await ensureApiServer();
  }

  const verifyEnv = {
    ...verificationBaseEnvironment,
    API_BASE_URL: activeApiBaseUrl,
    DIGITAL_SELF_API_BASE_URL: activeApiBaseUrl,
    NEXT_PUBLIC_API_BASE_URL: activeApiBaseUrl,
    VERIFY_MANAGED_API: "1",
  };

  for (const command of apiCommands) {
    await runCommand(command, {
      env: verifyEnv,
    });
  }

  logPass("Unified local verification completed");
} catch (error) {
  logFail(formatError(error));
  process.exitCode = 1;
} finally {
  await stopApiServer(serverProcess);
}

async function ensureApiServer() {
  if (verifySuite === "full") {
    const managedPort = await findAvailablePort();
    activeApiBaseUrl = `http://127.0.0.1:${managedPort}`;
    return startManagedApi(managedPort);
  }

  if (explicitApiBaseUrl) {
    if (await isApiHealthy(requestedApiBaseUrl)) {
      activeApiBaseUrl = requestedApiBaseUrl;
      logStep("Detected an existing API server at the explicit override URL");
      logStep(
        "Structured report generate verification will assume the explicit API was started with STRUCTURED_REPORT_GENERATOR_PROVIDER=fake.",
      );
      return null;
    }

    const explicitUrl = new URL(requestedApiBaseUrl);
    if (!isLocalHostname(explicitUrl.hostname)) {
      throw new Error(
        `Explicit API override ${requestedApiBaseUrl} is not healthy, and a non-local host cannot be started automatically.`,
      );
    }

    activeApiBaseUrl = requestedApiBaseUrl;
    return startManagedApi(explicitUrl.port.length > 0 ? Number(explicitUrl.port) : 3001);
  }

  if (await isApiHealthy(requestedApiBaseUrl)) {
    logStep(
      `Detected an existing API server at ${requestedApiBaseUrl}; starting an isolated verification API with fake provider instead of reusing it.`,
    );
  }

  const managedPort = await findAvailablePort();
  activeApiBaseUrl = `http://127.0.0.1:${managedPort}`;
  return startManagedApi(managedPort);
}

async function startManagedApi(port) {
  await runCommand(
    {
      label: "Isolated test database migrations",
      cmd: "corepack",
      args: ["pnpm", "db:migrate:deploy"],
    },
    { env: verificationBaseEnvironment },
  );
  logStep(`Starting the built API server on port ${port} for verification`);
  const child = spawn(process.execPath, ["--env-file=.env", "apps/api/dist/main.js"], {
    cwd: rootDir,
    env: {
      ...verificationBaseEnvironment,
      API_HOST: "127.0.0.1",
      PORT: String(port),
      STRUCTURED_REPORT_GENERATOR_PROVIDER:
        process.env.STRUCTURED_REPORT_GENERATOR_PROVIDER ?? "fake",
      EXTERNAL_SOURCE_SEARCH_PROVIDER: process.env.EXTERNAL_SOURCE_SEARCH_PROVIDER ?? "fake",
    },
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

async function isApiHealthy(baseUrl = activeApiBaseUrl) {
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

async function runCommand(command, options = {}) {
  logStep(`Running ${command.label}`);

  const startedAt = Date.now();

  await new Promise((resolve, reject) => {
    const child = spawn(command.cmd, command.args, {
      cwd: rootDir,
      env: options.env ?? process.env,
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }

      if (signal) {
        reject(new Error(`${command.label} terminated by signal ${signal}`));
        return;
      }

      reject(new Error(`${command.label} exited with code ${code ?? "unknown"}`));
    });
  });

  const elapsedMs = Date.now() - startedAt;
  logPass(`${command.label} passed in ${elapsedMs}ms`);
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function normalizeVerifySuite(value) {
  if (value === "quick" || value === "full") {
    return value;
  }

  throw new Error(`VERIFY_SUITE must be "quick" or "full", received "${value}".`);
}

async function findAvailablePort() {
  const server = net.createServer();

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(undefined));
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise((resolve) => server.close(() => resolve(undefined)));
    throw new Error("Failed to resolve an available local TCP port.");
  }

  const { port } = address;
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(undefined);
    });
  });

  return port;
}

function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function formatError(error) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

function logStep(message) {
  console.log(`[verify:all-local] ${message}`);
}

function logPass(message) {
  console.log(`[verify:all-local] PASS ${message}`);
}

function logFail(message) {
  console.error(`[verify:all-local] FAIL ${message}`);
}
