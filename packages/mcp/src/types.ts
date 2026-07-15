import type { JsonSchemaDraft, McpToolDefinition, McpToolName } from "./tools";

export interface McpTextContentBlock {
  type: "text";
  text: string;
}

export type McpToolContentBlock = McpTextContentBlock;

export interface McpToolExecutionResult<
  TStructuredContent = unknown,
  TMeta extends Record<string, unknown> = Record<string, unknown>,
> {
  content: McpToolContentBlock[];
  structuredContent?: TStructuredContent;
  isError?: boolean;
  _meta?: TMeta;
}

export interface McpToolContext<
  TTransportContext = unknown,
  TRequestId extends string | number | null = string | number | null,
> {
  toolName: McpToolName;
  requestId?: TRequestId;
  signal?: AbortSignal;
  transportContext?: TTransportContext;
}

export type McpToolHandler<
  TArguments = unknown,
  TResult extends McpToolExecutionResult = McpToolExecutionResult,
> = (
  arguments_: TArguments,
  context: McpToolContext,
) => Promise<TResult> | TResult;

export type McpToolHandlerMap = Partial<Record<McpToolName, McpToolHandler>>;

export interface DigitalSelfMcpServerInfo {
  name: string;
  version: string;
  instructions?: string;
}

export interface ExecuteToolOptions {
  requestId?: string | number | null;
  signal?: AbortSignal;
  transportContext?: unknown;
}

export interface McpJsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export interface McpJsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface McpJsonRpcSuccessResponse<TResult = unknown> {
  jsonrpc: "2.0";
  id: string | number | null;
  result: TResult;
}

export interface McpJsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  error: McpJsonRpcError;
}

export type McpJsonRpcResponse<TResult = unknown> =
  | McpJsonRpcSuccessResponse<TResult>
  | McpJsonRpcErrorResponse;

export interface DigitalSelfMcpServerOptions {
  serverInfo?: Partial<DigitalSelfMcpServerInfo>;
  handlers?: McpToolHandlerMap;
}

export interface DigitalSelfMcpServer {
  readonly serverInfo: DigitalSelfMcpServerInfo;
  listTools(): ReadonlyArray<McpToolDefinition>;
  getToolDefinition(name: string): McpToolDefinition | undefined;
  getToolInputSchema(name: string): JsonSchemaDraft | undefined;
  isToolName(name: string): name is McpToolName;
  hasHandler(name: McpToolName): boolean;
  registerToolHandler(name: McpToolName, handler: McpToolHandler): void;
  registerToolHandlers(handlers: McpToolHandlerMap): void;
  executeTool(
    name: McpToolName,
    arguments_: unknown,
    options?: ExecuteToolOptions,
  ): Promise<McpToolExecutionResult>;
  handleRequest(
    request: McpJsonRpcRequest,
    options?: Omit<ExecuteToolOptions, "requestId">,
  ): Promise<McpJsonRpcResponse>;
}
