export class DigitalSelfMcpError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class McpUnknownToolError extends DigitalSelfMcpError {
  constructor(toolName: string) {
    super(`Unknown MCP tool "${toolName}".`, "UNKNOWN_TOOL", {
      toolName,
    });
  }
}

export class McpToolInputValidationError extends DigitalSelfMcpError {
  constructor(toolName: string, issues: string[]) {
    super(
      `Invalid input for MCP tool "${toolName}": ${issues.join("; ")}`,
      "INVALID_TOOL_INPUT",
      {
        toolName,
        issues,
      },
    );
  }
}

export class McpUnsupportedMethodError extends DigitalSelfMcpError {
  constructor(method: string) {
    super(`Unsupported MCP method "${method}".`, "UNSUPPORTED_METHOD", {
      method,
    });
  }
}
