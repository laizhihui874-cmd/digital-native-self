export type ModelModality = "text" | "image" | "audio" | "file";

export type ModelStructuredOutputSupport =
  | "native-json"
  | "json-schema-prompting"
  | "text-only";

export type ToolCallingSupport = "none" | "model-native" | "adapter-managed";

export interface ModelCapabilities {
  supportsStreaming: boolean;
  supportsSystemMessage: boolean;
  supportsStructuredOutput: ModelStructuredOutputSupport;
  supportsToolCalling: ToolCallingSupport;
  supportsReasoningTokens: boolean;
  supportsOpenAiCompatibleRelay: boolean;
  inputModalities: ModelModality[];
  outputModalities: ModelModality[];
  maxContextTokens?: number;
  maxOutputTokens?: number;
}

export interface ModelRelayConfig {
  provider: "openai" | "openai-compatible" | "custom";
  modelId: string;
  displayName?: string;
  baseUrl?: string;
  baseURL?: string;
  apiKeyEnvVar?: string;
  defaultHeaders?: Record<string, string>;
  defaultQuery?: Record<string, string>;
}

export interface ModelMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  toolCallId?: string;
  metadata?: Record<string, unknown>;
}

export interface ModelToolDefinition {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface ModelCallOptions {
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  responseFormat?:
    | {
        type: "text";
      }
    | {
        type: "json";
        schemaName: string;
        schema: Record<string, unknown>;
      };
  tools?: ModelToolDefinition[];
  metadata?: Record<string, unknown>;
}

export interface ModelToolCall {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
}

export interface ModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface ModelResponse {
  modelId: string;
  text: string;
  finishReason?:
    | "stop"
    | "length"
    | "tool-calls"
    | "content-filter"
    | "error";
  toolCalls?: ModelToolCall[];
  usage?: ModelUsage;
  rawResponse?: unknown;
}

export interface ModelStreamEvent {
  type:
    | "text-delta"
    | "tool-call-delta"
    | "response-complete"
    | "error";
  textDelta?: string;
  toolCall?: ModelToolCall;
  response?: ModelResponse;
  errorMessage?: string;
}

export interface ModelAdapter {
  readonly relay: ModelRelayConfig;

  getCapabilities(): ModelCapabilities;

  generate(
    messages: ModelMessage[],
    options?: ModelCallOptions,
  ): Promise<ModelResponse>;

  stream?(
    messages: ModelMessage[],
    options?: ModelCallOptions,
  ): AsyncIterable<ModelStreamEvent>;
}

export interface StaticModelAdapterOptions {
  relay?: ModelRelayConfig;
  response?: ModelResponse | string;
  generateResult?: (
    messages: ModelMessage[],
    options?: ModelCallOptions,
  ) => Promise<ModelResponse | string> | ModelResponse | string;
  capabilities?: Partial<ModelCapabilities>;
}
