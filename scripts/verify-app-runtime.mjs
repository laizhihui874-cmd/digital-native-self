#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { assertIsolatedVerificationRuntime } from "./lib/test-database-safety.mjs";

assertIsolatedVerificationRuntime();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtime = path.join(root, "storage", "runtime-verification", String(Date.now()));
const apiPort = await availablePort();
const webPort = await availablePort(new Set([apiPort]));
const env = {
  ...process.env,
  DATABASE_URL: process.env.TEST_DATABASE_URL,
  APP_RUNTIME_DIR: runtime,
  APP_NO_OPEN: "1",
  APP_DATABASE_WAIT_MS: "15000",
  APP_SERVICE_WAIT_MS: "25000",
  API_PORT: String(apiPort),
  WEB_PORT: String(webPort),
  PORT: String(apiPort),
  API_HOST: "127.0.0.1",
  NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${apiPort}`,
};

let registry;
try {
  verifyDockerRecoveryBranch();
  verifyMigrationFailureBranch();
  const firstStart = run("start");
  assert.equal(firstStart.status, 0, `first launcher start must succeed\n${firstStart.stdout}\n${firstStart.stderr}\nAPI log:\n${safeRead("api.log")}\nWeb log:\n${safeRead("web.log")}`);
  registry = readRegistry();
  assert.ok(alive(registry.api.pid) && alive(registry.web.pid));
  const firstPids = [registry.api.pid, registry.web.pid];

  const repeated = run("start");
  assert.equal(repeated.status, 0, repeated.stderr);
  registry = readRegistry();
  assert.deepEqual([registry.api.pid, registry.web.pid], firstPids, "repeat start must reuse running services");

  process.kill(-registry.api.pid, "SIGKILL");
  await waitUntil(() => !alive(registry.api.pid));
  const restarted = run("start");
  assert.equal(restarted.status, 0, restarted.stderr);
  const recovered = readRegistry();
  registry = recovered;
  assert.notEqual(recovered.api.pid, firstPids[0]);
  assert.notEqual(recovered.web.pid, firstPids[1]);
  assert.ok(alive(recovered.api.pid) && alive(recovered.web.pid));

  const postgresBefore = dockerPostgresId();
  const stopped = run("stop");
  assert.equal(stopped.status, 0, stopped.stderr);
  await waitUntil(() => !alive(recovered.api.pid) && !alive(recovered.web.pid));
  assert.equal(dockerPostgresId(), postgresBefore, "launcher stop must leave PostgreSQL running");

  const blocker = net.createServer();
  await new Promise((resolve, reject) => blocker.once("error", reject).listen(apiPort, "127.0.0.1", resolve));
  const conflict = run("start");
  assert.notEqual(conflict.status, 0);
  assert.match(`${conflict.stdout}\n${conflict.stderr}`, new RegExp(`API 端口 ${apiPort}.*占用`, "s"));
  assert.equal(blocker.listening, true, "launcher must not stop an unregistered process");
  const noRegistryStop = run("stop");
  assert.equal(noRegistryStop.status, 0);
  assert.equal(blocker.listening, true);
  await new Promise((resolve) => blocker.close(resolve));

  const status = run("status");
  assert.equal(status.status, 0, status.stderr);
  const statusPayload = JSON.parse(status.stdout);
  assert.equal(statusPayload.registered, null);
  assert.equal(statusPayload.ports.api, apiPort);
  assert.equal(statusPayload.ports.web, webPort);
  assert.ok(existsSync(path.join(runtime, "launcher.log")));
  assert.ok(existsSync(path.join(runtime, "status.json")));
  console.log("PASS macOS launcher Docker recovery, migration failure, first/repeat start, abnormal exit recovery, conflict handling, registered-only stop and PostgreSQL lifecycle verification completed");
} finally {
  if (registry) {
    run("stop");
    if (alive(registry.api?.pid)) try { process.kill(-registry.api.pid, "SIGKILL"); } catch {}
    if (alive(registry.web?.pid)) try { process.kill(-registry.web.pid, "SIGKILL"); } catch {}
  }
  rmSync(runtime, { recursive: true, force: true });
}

function run(command, environmentOverrides = {}) {
  return spawnSync(process.execPath, [path.join(root, "scripts", "app-runtime.mjs"), command], { cwd: root, env: { ...env, ...environmentOverrides }, encoding: "utf8", timeout: 120_000 });
}

function verifyDockerRecoveryBranch() {
  const fakeBin = path.join(runtime, "fake-bin");
  const fakeDocker = path.join(fakeBin, "docker");
  const statePath = path.join(runtime, "fake-docker-state.json");
  mkdirSync(fakeBin, { recursive: true });
  writeFileSync(fakeDocker, `#!${process.execPath}\nconst fs = require("node:fs");\nconst statePath = process.env.FAKE_DOCKER_STATE;\nlet state = { infoCalls: 0, composeUp: false };\ntry { state = JSON.parse(fs.readFileSync(statePath, "utf8")); } catch {}\nif (process.argv[2] === "info") { state.infoCalls += 1; fs.writeFileSync(statePath, JSON.stringify(state)); if (state.infoCalls < 3) process.exit(1); console.log("test-docker-ready"); process.exit(0); }\nif (process.argv[2] === "compose" && process.argv.includes("up")) { state.composeUp = true; fs.writeFileSync(statePath, JSON.stringify(state)); process.exit(0); }\nprocess.exit(0);\n`);
  chmodSync(fakeDocker, 0o755);
  const result = run("__verify-docker-recovery", {
    PATH: `${fakeBin}:${process.env.PATH ?? "/usr/bin:/bin"}`,
    FAKE_DOCKER_STATE: statePath,
    APP_DATABASE_WAIT_MS: "10000",
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  assert.ok(state.infoCalls >= 3, "launcher must wait until Docker reports ready");
  assert.equal(state.composeUp, true, "launcher must start the postgres compose service");
}

function verifyMigrationFailureBranch() {
  const fakeBin = path.join(runtime, "fake-migration-bin");
  const fakeCorepack = path.join(fakeBin, "corepack");
  const fakePgDump = path.join(fakeBin, "pg_dump");
  const statePath = path.join(runtime, "fake-migration-state.json");
  const backupDirectory = path.join(runtime, "migration-backups");
  mkdirSync(fakeBin, { recursive: true });
  writeFileSync(fakeCorepack, `#!${process.execPath}\nconst fs = require("node:fs");\nconst statePath = process.env.FAKE_MIGRATION_STATE;\nlet state = { deployCalled: false };\ntry { state = JSON.parse(fs.readFileSync(statePath, "utf8")); } catch {}\nif (process.argv.includes("prisma:migrate:status")) { console.log("Following migrations have not yet been applied: test_pending"); process.exit(1); }\nif (process.argv.includes("prisma:migrate:deploy")) { state.deployCalled = true; fs.writeFileSync(statePath, JSON.stringify(state)); console.error("simulated migration failure"); process.exit(1); }\nprocess.exit(0);\n`);
  writeFileSync(fakePgDump, `#!${process.execPath}\nprocess.stdout.write("fake-backup");\n`);
  chmodSync(fakeCorepack, 0o755);
  chmodSync(fakePgDump, 0o755);
  const result = run("__verify-migration-failure", {
    PATH: `${fakeBin}:${process.env.PATH ?? "/usr/bin:/bin"}`,
    FAKE_MIGRATION_STATE: statePath,
    APP_BACKUP_DIR: backupDirectory,
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /数据库迁移失败/);
  assert.equal(JSON.parse(readFileSync(statePath, "utf8")).deployCalled, true);
  assert.ok(existsSync(backupDirectory) && readDirectory(backupDirectory).some((name) => name.endsWith(".dump")), "migration failure must retain its pre-migration backup");
}

function readDirectory(directory) {
  return readdirSync(directory);
}

function readRegistry() {
  return JSON.parse(readFileSync(path.join(runtime, "processes.json"), "utf8"));
}

function safeRead(name) {
  try { return readFileSync(path.join(runtime, name), "utf8").slice(-4_000); } catch { return "(missing)"; }
}

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function waitUntil(check) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (check()) return;
    await delay(100);
  }
  assert.fail("process state did not change before timeout");
}

async function availablePort(excluded = new Set()) {
  while (true) {
    const server = net.createServer();
    const port = await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", () => resolve(server.address().port)));
    await new Promise((resolve) => server.close(resolve));
    if (!excluded.has(port)) return port;
  }
}

function dockerPostgresId() {
  const result = spawnSync("docker", ["compose", "ps", "-q", "postgres"], { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}
