import type { JsonSchemaDraft } from "./tools";

interface ValidationState {
  path: string;
  issues: string[];
}

function appendIssue(state: ValidationState, message: string): void {
  state.issues.push(`${state.path}: ${message}`);
}

function validateEnum(
  schema: JsonSchemaDraft,
  value: unknown,
  state: ValidationState,
): void {
  if (schema.enum && !schema.enum.some((candidate) => candidate === value)) {
    appendIssue(
      state,
      `expected one of ${schema.enum.map(String).join(", ")}, received ${JSON.stringify(value)}`,
    );
  }
}

function validateObject(
  schema: JsonSchemaDraft,
  value: unknown,
  state: ValidationState,
): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    appendIssue(state, "expected object");
    return;
  }

  const record = value as Record<string, unknown>;
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  for (const requiredKey of required) {
    if (!(requiredKey in record)) {
      state.issues.push(`${state.path}.${requiredKey}: is required`);
    }
  }

  if (schema.additionalProperties === false) {
    for (const key of Object.keys(record)) {
      if (!(key in properties)) {
        state.issues.push(`${state.path}.${key}: is not allowed`);
      }
    }
  }

  for (const [key, propertySchema] of Object.entries(properties)) {
    if (!(key in record)) {
      continue;
    }

    validateJsonSchemaValue(propertySchema, record[key], `${state.path}.${key}`, state.issues);
  }
}

function validateArray(
  schema: JsonSchemaDraft,
  value: unknown,
  state: ValidationState,
): void {
  if (!Array.isArray(value)) {
    appendIssue(state, "expected array");
    return;
  }

  if (!schema.items) {
    return;
  }

  value.forEach((item, index) => {
    validateJsonSchemaValue(schema.items as JsonSchemaDraft, item, `${state.path}[${index}]`, state.issues);
  });
}

export function validateJsonSchemaValue(
  schema: JsonSchemaDraft,
  value: unknown,
  path = "$",
  issues: string[] = [],
): string[] {
  const state: ValidationState = { path, issues };

  switch (schema.type) {
    case "string":
      if (typeof value !== "string") {
        appendIssue(state, "expected string");
      }
      break;
    case "number":
      if (typeof value !== "number" || Number.isNaN(value)) {
        appendIssue(state, "expected number");
      }
      break;
    case "integer":
      if (!Number.isInteger(value)) {
        appendIssue(state, "expected integer");
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        appendIssue(state, "expected boolean");
      }
      break;
    case "object":
      validateObject(schema, value, state);
      break;
    case "array":
      validateArray(schema, value, state);
      break;
    default: {
      const exhaustiveCheck: never = schema.type;
      throw new Error(`Unsupported schema type: ${String(exhaustiveCheck)}`);
    }
  }

  validateEnum(schema, value, state);
  return issues;
}
