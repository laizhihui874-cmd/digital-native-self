const TEST_MARKER_PATTERN = /(^|[_-])(test|testing|verify|verification|ci)([_-]|$)/i;

export function resolveTestDatabaseEnvironment(environment = process.env) {
  const rawUrl = environment.TEST_DATABASE_URL?.trim();
  if (!rawUrl) {
    throw new Error(
      "TEST_DATABASE_URL is required for database verification. Personal DATABASE_URL values are not accepted.",
    );
  }

  const parsed = parsePostgresUrl(rawUrl);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  const schemaName = parsed.searchParams.get("schema") ?? "public";
  const hasTestMarker = TEST_MARKER_PATTERN.test(databaseName) || TEST_MARKER_PATTERN.test(schemaName);

  if (!databaseName || !hasTestMarker) {
    throw new Error(
      "TEST_DATABASE_URL must use a database name or schema containing test, testing, verify, verification, or ci.",
    );
  }

  if (databaseName === "digital_self" && schemaName === "public") {
    throw new Error("The default digital_self.public database is not an isolated test target.");
  }

  const personalUrl = environment.DATABASE_URL?.trim();
  if (
    environment.VERIFY_DATABASE_ISOLATED !== "1" &&
    personalUrl &&
    normalizeDatabaseTarget(personalUrl) === normalizeDatabaseTarget(rawUrl)
  ) {
    throw new Error("TEST_DATABASE_URL resolves to the same database and schema as DATABASE_URL.");
  }

  const directUrl = environment.TEST_DIRECT_URL?.trim() || rawUrl;
  const parsedDirect = parsePostgresUrl(directUrl);
  if (normalizeDatabaseTarget(directUrl) !== normalizeDatabaseTarget(rawUrl)) {
    throw new Error("TEST_DIRECT_URL must resolve to the same isolated database and schema as TEST_DATABASE_URL.");
  }

  return {
    databaseUrl: rawUrl,
    directUrl: parsedDirect.toString(),
    databaseName,
    schemaName,
  };
}

export function assertIsolatedVerificationRuntime(environment = process.env) {
  const target = resolveTestDatabaseEnvironment(environment);
  if (environment.VERIFY_DATABASE_ISOLATED !== "1") {
    throw new Error(
      "Database verification must be started through the isolated verification runner.",
    );
  }

  if (normalizeDatabaseTarget(environment.DATABASE_URL ?? "") !== normalizeDatabaseTarget(target.databaseUrl)) {
    throw new Error("DATABASE_URL is not set to the approved TEST_DATABASE_URL target.");
  }

  return target;
}

export function createIsolatedVerificationEnvironment(environment = process.env) {
  const target = resolveTestDatabaseEnvironment(environment);
  return {
    ...environment,
    DATABASE_URL: target.databaseUrl,
    DIRECT_URL: target.directUrl,
    VERIFY_DATABASE_ISOLATED: "1",
    NODE_ENV: "test",
    STORAGE_DIR: `./storage/test-verification/${target.databaseName}`,
  };
}

function parsePostgresUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("The test database connection string is not a valid URL.");
  }

  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("The test database connection string must use postgresql:// or postgres://.");
  }

  return parsed;
}

function normalizeDatabaseTarget(value) {
  if (!value) return "";
  const parsed = parsePostgresUrl(value);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  const schemaName = parsed.searchParams.get("schema") ?? "public";
  return `${parsed.hostname.toLowerCase()}:${parsed.port || "5432"}/${databaseName}?schema=${schemaName}`;
}
