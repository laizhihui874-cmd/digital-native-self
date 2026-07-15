import {
  DigitalSelfMcpError,
  McpToolInputValidationError,
  McpUnknownToolError,
  McpUnsupportedMethodError,
} from "./errors";
import {
  getMcpToolDefinition,
  getMcpToolInputSchema,
  isMcpToolName,
  listMcpTools,
  type McpToolName,
} from "./tools";
import type {
  DigitalSelfMcpServer,
  DigitalSelfMcpServerInfo,
  DigitalSelfMcpServerOptions,
  ExecuteToolOptions,
  McpJsonRpcRequest,
  McpJsonRpcResponse,
  McpToolContext,
  McpToolExecutionResult,
  McpToolHandler,
  McpToolHandlerMap,
} from "./types";
import { validateJsonSchemaValue } from "./validation";

const DEFAULT_SERVER_INFO: DigitalSelfMcpServerInfo = {
  name: "@digital-self/mcp",
  version: "0.1.0",
};

const JSON_RPC_VERSION = "2.0";
const JSON_RPC_INVALID_PARAMS = -32602;
const JSON_RPC_METHOD_NOT_FOUND = -32601;
const JSON_RPC_INTERNAL_ERROR = -32603;

interface ToolCallParams {
  name: string;
  arguments?: unknown;
}

export function createMcpToolErrorResult(
  toolName: string,
  code: string,
  message: string,
  details?: unknown,
): McpToolExecutionResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: message,
      },
    ],
    structuredContent: {
      toolName,
      code,
      details,
    },
  };
}

function createInvalidParamsResponse(
  id: string | number | null,
  message: string,
  data?: unknown,
): McpJsonRpcResponse {
  return {
    jsonrpc: JSON_RPC_VERSION,
    id,
    error: {
      code: JSON_RPC_INVALID_PARAMS,
      message,
      data,
    },
  };
}

function createErrorResponse(
  id: string | number | null,
  error: unknown,
): McpJsonRpcResponse {
  if (error instanceof McpUnsupportedMethodError) {
    return {
      jsonrpc: JSON_RPC_VERSION,
      id,
      error: {
        code: JSON_RPC_METHOD_NOT_FOUND,
        message: error.message,
        data: error.details,
      },
    };
  }

  if (
    error instanceof McpUnknownToolError ||
    error instanceof McpToolInputValidationError
  ) {
    return {
      jsonrpc: JSON_RPC_VERSION,
      id,
      error: {
        code: JSON_RPC_INVALID_PARAMS,
        message: error.message,
        data: error.details,
      },
    };
  }

  if (error instanceof DigitalSelfMcpError) {
    return {
      jsonrpc: JSON_RPC_VERSION,
      id,
      error: {
        code: JSON_RPC_INTERNAL_ERROR,
        message: error.message,
        data: error.details,
      },
    };
  }

  return {
    jsonrpc: JSON_RPC_VERSION,
    id,
    error: {
      code: JSON_RPC_INTERNAL_ERROR,
      message: error instanceof Error ? error.message : "Unknown MCP server error.",
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getToolCallParams(
  value: unknown,
): { params: ToolCallParams } | { error: { message: string; data?: unknown } } {
  if (!isObject(value)) {
    return {
      error: {
        message: 'Expected object params for "tools/call".',
      },
    };
  }

  const name = value.name;
  if (typeof name !== "string") {
    return {
      error: {
        message: 'Expected string "name" for "tools/call".',
      },
    };
  }

  if ("arguments" in value) {
    return {
      params: {
        name,
        arguments: value.arguments,
      },
    };
  }

  return {
    params: {
      name,
    },
  };
}

class DigitalSelfMcpServerImpl implements DigitalSelfMcpServer {
  readonly serverInfo: DigitalSelfMcpServerInfo;
  private readonly handlers = new Map<McpToolName, McpToolHandler>();

  constructor(options: DigitalSelfMcpServerOptions = {}) {
    this.serverInfo = {
      ...DEFAULT_SERVER_INFO,
      ...options.serverInfo,
    };

    if (options.handlers) {
      this.registerToolHandlers(options.handlers);
    }
  }

  listTools() {
    return listMcpTools();
  }

  getToolDefinition(name: string) {
    return getMcpToolDefinition(name);
  }

  getToolInputSchema(name: string) {
    return getMcpToolInputSchema(name);
  }

  isToolName(name: string): name is McpToolName {
    return isMcpToolName(name);
  }

  hasHandler(name: McpToolName): boolean {
    return this.handlers.has(name);
  }

  registerToolHandler(name: McpToolName, handler: McpToolHandler): void {
    this.handlers.set(name, handler);
  }

  registerToolHandlers(handlers: McpToolHandlerMap): void {
    for (const [name, handler] of Object.entries(handlers)) {
      if (!handler) {
        continue;
      }

      if (!isMcpToolName(name)) {
        throw new McpUnknownToolError(name);
      }

      this.registerToolHandler(name, handler);
    }
  }

  async executeTool(
    name: McpToolName,
    arguments_: unknown,
    options: ExecuteToolOptions = {},
  ): Promise<McpToolExecutionResult> {
    const definition = this.getToolDefinition(name);

    if (!definition) {
      throw new McpUnknownToolError(name);
    }

    const issues = validateJsonSchemaValue(definition.inputSchema, arguments_);
    if (issues.length > 0) {
      throw new McpToolInputValidationError(name, issues);
    }

    const handler = this.handlers.get(name);
    if (!handler) {
      return createMcpToolErrorResult(
        name,
        "NOT_IMPLEMENTED",
        `MCP tool "${name}" has no handler registered in this server instance.`,
      );
    }

    try {
      const context: McpToolContext = {
        toolName: name,
        requestId: options.requestId,
        signal: options.signal,
        transportContext: options.transportContext,
      };
      const result = await handler(arguments_, context);

      if (!result || !Array.isArray(result.content)) {
        return createMcpToolErrorResult(
          name,
          "INVALID_HANDLER_RESULT",
          `MCP tool "${name}" handler returned an invalid result.`,
        );
      }

      return result;
    } catch (error) {
      return createMcpToolErrorResult(
        name,
        "TOOL_EXECUTION_FAILED",
        error instanceof Error ? error.message : `MCP tool "${name}" failed.`,
      );
    }
  }

  async handleRequest(
    request: McpJsonRpcRequest,
    options: Omit<ExecuteToolOptions, "requestId"> = {},
  ): Promise<McpJsonRpcResponse> {
    const id = request.id ?? null;

    try {
      switch (request.method) {
        case "tools/list":
          return {
            jsonrpc: JSON_RPC_VERSION,
            id,
            result: {
              tools: this.listTools(),
            },
          };
        case "tools/call": {
          const toolCallParams = getToolCallParams(request.params);
          if ("error" in toolCallParams) {
            return createInvalidParamsResponse(
              id,
              toolCallParams.error.message,
              toolCallParams.error.data,
            );
          }

          const { name: toolName, arguments: toolArguments } = toolCallParams.params;

          if (!this.isToolName(toolName)) {
            throw new McpUnknownToolError(toolName);
          }

          const result = await this.executeTool(toolName, toolArguments ?? {}, {
            ...options,
            requestId: id,
          });

          return {
            jsonrpc: JSON_RPC_VERSION,
            id,
            result,
          };
        }
        default:
          throw new McpUnsupportedMethodError(request.method);
      }
    } catch (error) {
      return createErrorResponse(id, error);
    }
  }
}

export function createDigitalSelfMcpServer(
  options: DigitalSelfMcpServerOptions = {},
): DigitalSelfMcpServer {
  return new DigitalSelfMcpServerImpl(options);
}

export function createNotImplementedMcpToolResult(
  toolName: McpToolName,
): McpToolExecutionResult {
  return createMcpToolErrorResult(
    toolName,
    "NOT_IMPLEMENTED",
    `MCP tool "${toolName}" has no handler registered in this server instance.`,
  );
}
