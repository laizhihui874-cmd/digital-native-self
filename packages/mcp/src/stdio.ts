#!/usr/bin/env node

import type { Readable, Writable } from "node:stream";

import {
  createDigitalSelfMcpServerWithApiHandlers,
  type CreateDigitalSelfMcpServerWithApiHandlersOptions,
} from "./api-handlers";
import type {
  DigitalSelfMcpServer,
  McpJsonRpcErrorResponse,
} from "./types";

interface SdkTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

interface SdkCallToolResult {
  content?: unknown;
  structuredContent?: unknown;
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

interface SdkRequestHandlerExtra {
  requestId: string | number;
  signal: AbortSignal;
  sessionId?: string;
  requestInfo?: unknown;
  _meta?: unknown;
}

interface SdkServerLike {
  setRequestHandler(
    schema: unknown,
    handler: (request: {
      method: string;
      params: {
        name: string;
        arguments?: Record<string, unknown>;
      };
    }, extra: SdkRequestHandlerExtra) => Promise<unknown> | unknown,
  ): void;
  connect(transport: unknown): Promise<void>;
  close(): Promise<void>;
}

interface SdkStdioServerTransportLike {
  onerror?: (error: Error) => void;
}

interface ServerConstructor {
  new (
    serverInfo: { name: string; version: string },
    options?: {
      capabilities?: ServerCapabilities;
      instructions?: string;
    },
  ): SdkServerLike;
}

interface StdioServerTransportConstructor {
  new (stdin?: Readable, stdout?: Writable): SdkStdioServerTransportLike;
}

interface McpErrorConstructor {
  fromError(code: number, message: string, data?: unknown): Error;
}

interface ServerCapabilities {
  tools: Record<string, never>;
}

const { Server } =
  require("@modelcontextprotocol/sdk/server/index.js") as {
    Server: ServerConstructor;
  };
const { StdioServerTransport } =
  require("@modelcontextprotocol/sdk/server/stdio.js") as {
    StdioServerTransport: StdioServerTransportConstructor;
  };
const { CallToolRequestSchema, ListToolsRequestSchema, McpError } =
  require("@modelcontextprotocol/sdk/types.js") as {
    CallToolRequestSchema: unknown;
    ListToolsRequestSchema: unknown;
    McpError: McpErrorConstructor;
  };

const DEFAULT_SERVER_CAPABILITIES: ServerCapabilities = {
  tools: {},
};

export interface DigitalSelfMcpSdkServer {
  coreServer: DigitalSelfMcpServer;
  sdkServer: SdkServerLike;
}

export interface StartDigitalSelfMcpStdioServerOptions
  extends CreateDigitalSelfMcpServerWithApiHandlersOptions {
  stdin?: Readable;
  stdout?: Writable;
  stderr?: Writable;
}

export interface StartedDigitalSelfMcpStdioServer extends DigitalSelfMcpSdkServer {
  transport: SdkStdioServerTransportLike;
  close(): Promise<void>;
}

function toSdkToolDefinition(
  tool: ReturnType<DigitalSelfMcpServer["listTools"]>[number],
): SdkTool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema as unknown as Record<string, unknown>,
    outputSchema: tool.outputSchema as unknown as Record<string, unknown>,
  };
}

function toSdkError(response: McpJsonRpcErrorResponse): Error {
  return McpError.fromError(
    response.error.code,
    response.error.message,
    response.error.data,
  );
}

function writeStderr(stderr: Writable, message: string): void {
  stderr.write(`${message}\n`);
}

export function createDigitalSelfMcpSdkServer(
  options: CreateDigitalSelfMcpServerWithApiHandlersOptions = {},
): DigitalSelfMcpSdkServer {
  const coreServer = createDigitalSelfMcpServerWithApiHandlers(options);
  const sdkServer = new Server(
    {
      name: coreServer.serverInfo.name,
      version: coreServer.serverInfo.version,
    },
    {
      capabilities: DEFAULT_SERVER_CAPABILITIES,
      instructions: coreServer.serverInfo.instructions,
    },
  );

  sdkServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: coreServer.listTools().map(toSdkToolDefinition),
  }));

  sdkServer.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const response = await coreServer.handleRequest(
      {
        jsonrpc: "2.0",
        id: extra.requestId,
        method: request.method,
        params: {
          name: request.params.name,
          arguments: request.params.arguments,
        },
      },
      {
        signal: extra.signal,
        transportContext: {
          sessionId: extra.sessionId,
          requestInfo: extra.requestInfo,
          requestMeta: extra._meta,
        },
      },
    );

    if ("error" in response) {
      throw toSdkError(response);
    }

    return response.result as SdkCallToolResult;
  });

  return {
    coreServer,
    sdkServer,
  };
}

export async function startDigitalSelfMcpStdioServer(
  options: StartDigitalSelfMcpStdioServerOptions = {},
): Promise<StartedDigitalSelfMcpStdioServer> {
  const { stdin, stdout, stderr = process.stderr, ...serverOptions } = options;
  const bridge = createDigitalSelfMcpSdkServer(serverOptions);
  const transport = new StdioServerTransport(stdin, stdout);

  transport.onerror = (error) => {
    writeStderr(
      stderr,
      `[digital-self-mcp] stdio transport error: ${error.message}`,
    );
  };

  await bridge.sdkServer.connect(transport);

  return {
    ...bridge,
    transport,
    close: () => bridge.sdkServer.close(),
  };
}

async function main(): Promise<void> {
  await startDigitalSelfMcpStdioServer();
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.stack ?? error.message : String(error);

    writeStderr(process.stderr, `[digital-self-mcp] failed to start: ${message}`);
    process.exitCode = 1;
  });
}
