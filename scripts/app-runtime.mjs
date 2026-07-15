#!/usr/bin/env node

import { createConnection } from "node:net";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNTIME_DIR = path.resolve(ROOT, process.env.APP_RUNTIME_DIR || "storage/runtime");
const BACKUP_DIR = path.resolve(ROOT, process.env.APP_BACKUP_DIR || "storage/backups");
const REGISTRY_PATH = path.join(RUNTIME_DIR, "processes.json");
const STATUS_PATH = path.join(RUNTIME_DIR, "status.json");
const ERROR_PATH = path.join(RUNTIME_DIR, "last-error.log");
const API_LOG = path.join(RUNTIME_DIR, "api.log");
const WEB_LOG = path.join(RUNTIME_DIR, "web.log");
const LAUNCHER_LOG = path.join(RUNTIME_DIR, "launcher.log");
const API_PORT = Number(process.env.API_PORT || 3211);
const WEB_PORT = Number(process.env.WEB_PORT || 3212);
const API_URL = `http://127.0.0.1:${API_PORT}`;
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
const APP_NAME = "数字原生自我.app";
const LAUNCHER_VERSION = "1";
const WAIT_DATABASE_MS = Number(process.env.APP_DATABASE_WAIT_MS || 120_000);
const WAIT_SERVICE_MS = Number(process.env.APP_SERVICE_WAIT_MS || 45_000);
const packageJson = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));

mkdirSync(RUNTIME_DIR, { recursive: true });

function appendLauncherLog(message) {
  writeFileSync(LAUNCHER_LOG, `${new Date().toISOString()} ${message}\n`, { flag: "a" });
}

function fail(message, detail = "") {
  const full = detail ? `${message}\n${detail}` : message;
  writeFileSync(ERROR_PATH, `${new Date().toISOString()}\n${full}\n`);
  appendLauncherLog(`ERROR ${message}`);
  throw new Error(full);
}

function run(command, args, options = {}) {
  const { env: environmentOverrides = {}, ...spawnOptions } = options;
  return spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, ...environmentOverrides },
    maxBuffer: 20 * 1024 * 1024,
    ...spawnOptions,
  });
}

function commandExists(command) {
  return run("/usr/bin/which", [command]).status === 0;
}

function readRegistry() {
  try {
    return JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function processCommand(pid) {
  const result = run("/bin/ps", ["-p", String(pid), "-o", "command="]);
  return result.status === 0 ? result.stdout.trim() : "";
}

function processStartTime(pid) {
  const result = run("/bin/ps", ["-p", String(pid), "-o", "lstart="]);
  return result.status === 0 ? result.stdout.trim() : "";
}

function registeredProcessIsOurs(entry) {
  if (!entry || !isPidAlive(entry.pid)) return false;
  const sameStart = entry.startTime && processStartTime(entry.pid) === entry.startTime;
  return Boolean(sameStart || processCommand(entry.pid).includes(entry.marker));
}

async function portOpen(port) {
  return await new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const finish = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(700);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function httpOk(url, validator = () => true) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1_500);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return false;
    return validator(await response.text());
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function serviceState() {
  const [apiPortOpen, webPortOpen, apiHealthy, webHealthy] = await Promise.all([
    portOpen(API_PORT),
    portOpen(WEB_PORT),
    httpOk(`${API_URL}/api/health`, (body) => body.includes('"service":"ok"')),
    httpOk(WEB_URL),
  ]);
  return { apiPortOpen, webPortOpen, apiHealthy, webHealthy };
}

function ensureDependencies() {
  const missing = [];
  if (!commandExists("node")) missing.push("Node.js 22 或更高版本");
  if (!commandExists("corepack")) missing.push("Corepack/pnpm");
  if (!existsSync(path.join(ROOT, "node_modules"))) missing.push("项目依赖（请先在项目目录运行 corepack pnpm install）");
  if (!existsSync(path.join(ROOT, "apps/api/node_modules/.bin/prisma"))) missing.push("Prisma CLI（请重新安装项目依赖）");
  if (!existsSync(path.join(ROOT, "apps/api/dist/main.js"))) missing.push("API 生产构建（请运行 corepack pnpm app:install）");
  if (!existsSync(path.join(ROOT, "apps/web/.next/BUILD_ID"))) missing.push("Web 生产构建（请运行 corepack pnpm app:install）");
  if (missing.length) fail("启动所需内容不完整：", missing.map((item) => `- ${item}`).join("\n"));
}

function migrationStatus() {
  const result = run("corepack", ["pnpm", "--filter", "@digital-self/api", "prisma:migrate:status"]);
  return { ...result, output: `${result.stdout || ""}\n${result.stderr || ""}`.trim() };
}

function dockerReady() {
  return run("docker", ["info", "--format", "{{.ServerVersion}}"]).status === 0;
}

async function ensureDocker() {
  if (!commandExists("docker")) fail("无法连接 PostgreSQL，且没有找到 Docker 命令。请安装并启动 Docker Desktop。 ");
  if (!dockerReady()) {
    appendLauncherLog("Docker 未运行，正在打开 Docker Desktop");
    const opened = run("/usr/bin/open", ["-a", "Docker"]);
    if (opened.status !== 0) fail("无法打开 Docker Desktop。", opened.stderr.trim());
    const deadline = Date.now() + WAIT_DATABASE_MS;
    while (Date.now() < deadline) {
      if (dockerReady()) break;
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
    if (!dockerReady()) fail("Docker Desktop 在等待时间内没有启动完成。请打开 Docker Desktop 后重试。 ");
  }
  const up = run("docker", ["compose", "up", "-d", "postgres"]);
  if (up.status !== 0) fail("PostgreSQL 容器启动失败。", `${up.stdout}\n${up.stderr}`.trim());
}

function backupDatabase(reason) {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "_");
  const backupPath = path.join(BACKUP_DIR, `digital_self_${reason}_${stamp}.dump`);
  const databaseUrl = process.env.DATABASE_URL || readEnvValue("DATABASE_URL");
  if (!databaseUrl) fail("迁移前无法备份：.env 中缺少 DATABASE_URL。");
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    fail("迁移前无法备份：DATABASE_URL 格式不正确。");
  }
  const outputFd = openSync(backupPath, "w", 0o600);
  let result;
  try {
    if (commandExists("pg_dump")) {
      result = run("pg_dump", [
        "-Fc", "--no-owner", "--no-acl",
        "-h", parsed.hostname,
        "-p", parsed.port || "5432",
        "-U", decodeURIComponent(parsed.username || "postgres"),
        "-d", decodeURIComponent(parsed.pathname.replace(/^\//, "")),
      ], {
        env: { PGPASSWORD: decodeURIComponent(parsed.password || "") },
        stdio: ["ignore", outputFd, "pipe"],
      });
    } else if (dockerReady()) {
      result = run("docker", ["compose", "exec", "-T", "postgres", "pg_dump", "-Fc", "--no-owner", "--no-acl", "-U", decodeURIComponent(parsed.username || "postgres"), "-d", decodeURIComponent(parsed.pathname.replace(/^\//, ""))], {
        stdio: ["ignore", outputFd, "pipe"],
      });
    } else {
      fail("发现待执行迁移，但没有找到 pg_dump，也无法使用 PostgreSQL 容器备份。请先安装 PostgreSQL 客户端。 ");
    }
  } finally {
    closeSync(outputFd);
  }
  if (!result || result.status !== 0) {
    rmSync(backupPath, { force: true });
    fail("数据库备份失败，迁移没有执行。", result?.stderr?.trim() || "pg_dump 没有返回详细信息。");
  }
  appendLauncherLog(`迁移前备份已生成 ${backupPath}`);
  return backupPath;
}

function readEnvValue(key) {
  try {
    const line = readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/).find((item) => item.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim() : "";
  } catch {
    return "";
  }
}

async function ensureDatabaseAndMigrations() {
  let status = migrationStatus();
  if (status.status !== 0 && /connect|P1001|ECONNREFUSED|database server/i.test(status.output)) {
    await ensureDocker();
    const deadline = Date.now() + WAIT_DATABASE_MS;
    while (Date.now() < deadline) {
      status = migrationStatus();
      if (status.status === 0 || /following migration|not yet been applied|pending/i.test(status.output)) break;
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
  const pending = /following migration|not yet been applied|pending migration/i.test(status.output);
  if (pending) {
    const backupPath = backupDatabase("pre_migrate");
    appendLauncherLog(`开始执行数据库迁移，备份 ${backupPath}`);
    const deploy = run("corepack", ["pnpm", "--filter", "@digital-self/api", "prisma:migrate:deploy"]);
    if (deploy.status !== 0) fail("数据库迁移失败。数据库备份已保留。", `${deploy.stdout}\n${deploy.stderr}`.trim());
    status = migrationStatus();
  }
  if (status.status !== 0) fail("PostgreSQL 或数据库迁移状态检查失败。", status.output || "没有返回详细信息。");
  return status.output;
}

function spawnService(name, args, logPath, marker, environmentOverrides = {}) {
  const out = openSync(logPath, "a");
  const child = spawn(process.execPath, args, {
    cwd: ROOT,
    detached: true,
    stdio: ["ignore", out, out],
    env: { ...process.env, ...environmentOverrides },
  });
  child.unref();
  closeSync(out);
  appendLauncherLog(`${name} 已启动 PID=${child.pid}`);
  return { pid: child.pid, marker, startTime: processStartTime(child.pid), log: logPath };
}

async function waitForServices() {
  const deadline = Date.now() + WAIT_SERVICE_MS;
  while (Date.now() < deadline) {
    const state = await serviceState();
    if (state.apiHealthy && state.webHealthy) return state;
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  return serviceState();
}

function stopEntry(entry) {
  if (!registeredProcessIsOurs(entry)) return { stopped: false, reason: "not_running_or_identity_changed" };
  try {
    process.kill(-entry.pid, "SIGTERM");
  } catch {
    process.kill(entry.pid, "SIGTERM");
  }
  return { stopped: true };
}

async function openHomepage() {
  if (process.env.APP_NO_OPEN === "1") return;
  run("/usr/bin/open", [WEB_URL]);
}

async function start() {
  ensureDependencies();
  const initial = await serviceState();
  if (initial.apiHealthy && initial.webHealthy) {
    await ensureDatabaseAndMigrations();
    appendLauncherLog("API 与 Web 已运行，没有重复启动");
    await openHomepage();
    console.log(`数字原生自我已运行：${WEB_URL}`);
    return;
  }

  const registry = readRegistry();
  const registeredApi = registry?.api && registeredProcessIsOurs(registry.api);
  const registeredWeb = registry?.web && registeredProcessIsOurs(registry.web);
  if (registeredApi || registeredWeb) {
    if (registeredApi) stopEntry(registry.api);
    if (registeredWeb) stopEntry(registry.web);
    rmSync(REGISTRY_PATH, { force: true });
    const shutdownDeadline = Date.now() + 10_000;
    while (Date.now() < shutdownDeadline) {
      const current = await serviceState();
      const apiReleased = !registeredApi || (!registeredProcessIsOurs(registry.api) && !current.apiPortOpen);
      const webReleased = !registeredWeb || (!registeredProcessIsOurs(registry.web) && !current.webPortOpen);
      if (apiReleased && webReleased) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  const ports = await serviceState();
  const conflicts = [];
  if (ports.apiPortOpen) conflicts.push(`API 端口 ${API_PORT}`);
  if (ports.webPortOpen) conflicts.push(`Web 端口 ${WEB_PORT}`);
  if (conflicts.length) fail(`${conflicts.join("、")} 已被其他进程占用。请关闭占用进程，或先确认现有服务是否属于本项目。`);

  const migrationOutput = await ensureDatabaseAndMigrations();
  const api = spawnService("API", ["--env-file=.env", "apps/api/dist/main.js"], API_LOG, "apps/api/dist/main.js", {
    PORT: String(API_PORT),
    API_HOST: "127.0.0.1",
    CORS_ALLOWED_ORIGINS: WEB_URL,
  });
  const web = spawnService("Web", ["apps/web/node_modules/next/dist/bin/next", "start", "apps/web", "-p", String(WEB_PORT), "-H", "127.0.0.1"], WEB_LOG, "apps/web/node_modules/next/dist/bin/next");
  const registryValue = { launcherVersion: LAUNCHER_VERSION, startedAt: new Date().toISOString(), api, web };
  writeJson(REGISTRY_PATH, registryValue);

  const ready = await waitForServices();
  if (!ready.apiHealthy || !ready.webHealthy) {
    stopEntry(api);
    stopEntry(web);
    rmSync(REGISTRY_PATH, { force: true });
    fail("API 或 Web 没有在等待时间内启动完成。", `请查看日志：\n- ${API_LOG}\n- ${WEB_LOG}`);
  }

  const git = run("git", ["rev-parse", "--short", "HEAD"]);
  writeJson(STATUS_PATH, {
    launcherVersion: LAUNCHER_VERSION,
    appVersion: packageJson.version,
    nodeVersion: process.version,
    gitCommit: git.status === 0 ? git.stdout.trim() : null,
    startedAt: registryValue.startedAt,
    ports: { api: API_PORT, web: WEB_PORT },
    pids: { api: api.pid, web: web.pid },
    urls: { api: API_URL, web: WEB_URL },
    logs: { launcher: LAUNCHER_LOG, api: API_LOG, web: WEB_LOG },
    migrationStatus: migrationOutput.split(/\r?\n/).slice(-4).join("\n"),
  });
  rmSync(ERROR_PATH, { force: true });
  await openHomepage();
  console.log(`数字原生自我已启动：${WEB_URL}`);
}

async function stop() {
  const registry = readRegistry();
  if (!registry) {
    console.log("没有启动器登记的 API/Web 进程，未停止任何进程。PostgreSQL 保持运行。");
    return;
  }
  const api = stopEntry(registry.api);
  const web = stopEntry(registry.web);
  rmSync(REGISTRY_PATH, { force: true });
  appendLauncherLog(`停止完成 API=${api.stopped} Web=${web.stopped}`);
  console.log(`已停止启动器登记的进程：API ${api.stopped ? "已停止" : "未运行"}，Web ${web.stopped ? "已停止" : "未运行"}。PostgreSQL 保持运行。`);
}

async function status() {
  const registry = readRegistry();
  const services = await serviceState();
  const result = {
    appVersion: packageJson.version,
    launcherVersion: LAUNCHER_VERSION,
    ports: { api: API_PORT, web: WEB_PORT },
    services,
    registered: registry ? {
      startedAt: registry.startedAt,
      api: { pid: registry.api?.pid, alive: registeredProcessIsOurs(registry.api) },
      web: { pid: registry.web?.pid, alive: registeredProcessIsOurs(registry.web) },
    } : null,
    runtimeDirectory: RUNTIME_DIR,
    logs: { launcher: LAUNCHER_LOG, api: API_LOG, web: WEB_LOG, lastError: ERROR_PATH },
  };
  writeJson(STATUS_PATH, { ...result, checkedAt: new Date().toISOString() });
  console.log(JSON.stringify(result, null, 2));
}

function appleScriptString(value) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function install() {
  ensureProjectBuild();
  const corepack = run("/usr/bin/which", ["corepack"]).stdout.trim();
  if (!corepack) fail("没有找到 corepack，无法生成应用启动命令。");
  const repoBundle = path.join(ROOT, APP_NAME);
  const userApplications = path.join(homedir(), "Applications");
  const installedBundle = path.join(userApplications, APP_NAME);
  mkdirSync(userApplications, { recursive: true });
  rmSync(repoBundle, { recursive: true, force: true });
  rmSync(installedBundle, { recursive: true, force: true });
  const commandPath = Array.from(new Set([path.dirname(process.execPath), path.dirname(corepack), "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"])).join(":");
  const shellCommand = `export PATH=${shellQuote(commandPath)} && cd ${shellQuote(ROOT)} && ${shellQuote(corepack)} pnpm app:start`;
  const source = [
    "try",
    `do shell script ${appleScriptString(shellCommand)}`,
    "on error errorMessage number errorNumber",
    `display dialog ${appleScriptString("数字原生自我没有启动。\n\n")} & errorMessage buttons {\"好\"} default button 1 with icon stop`,
    "end try",
  ].join("\n");
  const sourcePath = path.join(RUNTIME_DIR, "launcher.applescript");
  writeFileSync(sourcePath, `${source}\n`);
  const compiled = run("/usr/bin/osacompile", ["-o", repoBundle, sourcePath]);
  if (compiled.status !== 0) fail("macOS 应用生成失败。", compiled.stderr.trim());
  const copied = run("/bin/cp", ["-R", repoBundle, installedBundle]);
  if (copied.status !== 0) fail("应用已生成，但复制到用户 Applications 目录失败。", copied.stderr.trim());
  appendLauncherLog(`应用已安装 ${installedBundle}`);
  console.log(`已生成：${repoBundle}\n已安装：${installedBundle}`);
}

function shellQuote(value) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function ensureProjectBuild() {
  if (!existsSync(path.join(ROOT, "node_modules"))) fail("缺少项目依赖。请先运行 corepack pnpm install。");
  appendLauncherLog("开始生成生产构建");
  const built = run("corepack", ["pnpm", "build"], { env: { NEXT_PUBLIC_API_BASE_URL: API_URL } });
  if (built.status !== 0) fail("生产构建失败，应用没有安装。", `${built.stdout}\n${built.stderr}`.trim());
}

const command = process.argv[2];
try {
  if (command === "start") await start();
  else if (command === "stop") await stop();
  else if (command === "status") await status();
  else if (command === "install") install();
  else if (command === "__verify-docker-recovery" && process.env.NODE_ENV === "test" && process.env.VERIFY_DATABASE_ISOLATED === "1") {
    await ensureDocker();
    console.log("Docker recovery branch completed");
  }
  else if (command === "__verify-migration-failure" && process.env.NODE_ENV === "test" && process.env.VERIFY_DATABASE_ISOLATED === "1") {
    await ensureDatabaseAndMigrations();
  }
  else fail("未知命令。可用命令：install、start、stop、status。");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
