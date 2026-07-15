#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  assertIsolatedVerificationRuntime,
  createIsolatedVerificationEnvironment,
  resolveTestDatabaseEnvironment,
} from "./lib/test-database-safety.mjs";

assert.throws(() => resolveTestDatabaseEnvironment({}), /TEST_DATABASE_URL is required/);
assert.throws(
  () =>
    resolveTestDatabaseEnvironment({
      TEST_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/digital_self?schema=public",
    }),
  /must use a database name or schema containing/,
);
assert.throws(
  () =>
    resolveTestDatabaseEnvironment({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/digital_self?schema=verify_ci",
      TEST_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/digital_self?schema=verify_ci",
    }),
  /same database and schema/,
);

const isolated = createIsolatedVerificationEnvironment({
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/digital_self?schema=public",
  TEST_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/digital_self?schema=verify_ci",
});
assert.equal(isolated.NODE_ENV, "test");
assert.equal(isolated.VERIFY_DATABASE_ISOLATED, "1");
assert.match(isolated.DATABASE_URL, /schema=verify_ci/);
assert.doesNotThrow(() => assertIsolatedVerificationRuntime(isolated));

console.log("PASS Test database safety verification completed");
