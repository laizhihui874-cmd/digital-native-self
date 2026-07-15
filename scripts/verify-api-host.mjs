#!/usr/bin/env node

import assert from "node:assert/strict";

import { resolveApiHost } from "../apps/api/dist/config/server-host.js";

assert.equal(resolveApiHost(undefined), "127.0.0.1");
assert.equal(resolveApiHost("127.0.0.1"), "127.0.0.1");
assert.equal(resolveApiHost(" ::1 "), "::1");
assert.throws(() => resolveApiHost("0.0.0.0"), /not allowed/);
assert.throws(() => resolveApiHost("192.168.1.10"), /not allowed/);

console.log("PASS API host boundary verification completed");
