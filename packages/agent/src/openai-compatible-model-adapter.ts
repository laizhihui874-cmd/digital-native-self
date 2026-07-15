import { generateText, streamText } from "ai";
import type {
  AssistantModelMessage,
  JSONValue,
  ModelMessage as AiSdkModelMessage,
  SystemModelMessage,
  ToolModelMessage,
  UserModelMessage,
} from "ai";
import {
  createOpenAICompatible,
  type OpenAICompatibleProviderSettings,
} from "@ai-sdk/openai-compatible";

import type {
  ModelAdapter,
  ModelCallOptions,
  ModelCapabilities,
  ModelMessage,
  ModelRelayConfig,
  ModelResponse,
  ModelStreamEvent,
  ModelToolCall,
  ModelUsage,
} from "./model-adapter";

const OPENAI_COMPATIBLE_MODEL_CAPABILITIES: ModelCapabilities = {
  supportsStreaming: true,
  supportsSystemMessage: true,
  supportsStructuredOutput: "text-only",
  supportsToolCalling: "none",
  supportsReasoningTokens: false,
  supportsOpenAiCompatibleRelay: true,
  inputModalities: ["text"],
  outputModalities: ["text"],
};

export class OpenAICompatibleModelAdapter implements ModelAdapter {
  readonly relay: ModelRelayConfig;
  private readonly apiKey?: string;

  constructor(relay: ModelRelayConfig, options: { apiKey?: string } = {}) {
    if (relay.provider !== "openai-compatible") {
      throw new Error(
        `OpenAICompatibleModelAdapter requires relay.provider="openai-compatible", received "${relay.provider}".`,
      );
    }

    this.relay = relay;
    this.apiKey = options.apiKey;
  }

  getCapabilities(): ModelCapabilities {
    return {
      ...OPENAI_COMPATIBLE_MODEL_CAPABILITIES,
    };
  }

  async generate(
    messages: ModelMessage[],
    options?: ModelCallOptions,
  ): Promise<ModelResponse> {
    if (options?.tools?.length) {
      throw new Error(
        "OpenAICompatibleModelAdapter does not support tool execution yet. Omit ModelCallOptions.tools for now.",
      );
    }

    if (options?.responseFormat?.type === "json") {
      throw new Error(
        'OpenAICompatibleModelAdapter currently supports text output only. JSON responseFormat is not implemented yet.',
      );
    }

    const provider = createOpenAICompatible(this.buildProviderSettings());
    const result = await generateText({
      model: provider(this.relay.modelId),
      messages: toAiSdkModelMessages(messages),
      allowSystemInMessages: true,
      temperature: options?.temperature,
      topP: options?.topP,
      maxOutputTokens: options?.maxOutputTokens,
      stopSequences: options?.stopSequences,
    });

    return {
      modelId: this.relay.modelId,
      text: result.text,
      finishReason: normalizeFinishReason(result.finishReason),
      toolCalls:
        result.toolCalls.length > 0
          ? result.toolCalls.map(mapToolCall)
          : undefined,
      usage: mapUsage(result.totalUsage ?? result.usage),
      rawResponse: result.response.body ?? result.response,
    };
  }

  async *stream(
    messages: ModelMessage[],
    options?: ModelCallOptions,
  ): AsyncIterable<ModelStreamEvent> {
    this.assertTextOnly(options);

    const provider = createOpenAICompatible(this.buildProviderSettings());
    const result = streamText({
      model: provider(this.relay.modelId),
      messages: toAiSdkModelMessages(messages),
      allowSystemInMessages: true,
      temperature: options?.temperature,
      topP: options?.topP,
      maxOutputTokens: options?.maxOutputTokens,
      stopSequences: options?.stopSequences,
    });

    let text = "";
    try {
      for await (const textDelta of result.textStream) {
        text += textDelta;
        yield { type: "text-delta", textDelta };
      }

      const [finishReason, usage] = await Promise.all([
        result.finishReason,
        result.totalUsage,
      ]);
      yield {
        type: "response-complete",
        response: {
          modelId: this.relay.modelId,
          text,
          finishReason: normalizeFinishReason(finishReason),
          usage: mapUsage(usage),
        },
      };
    } catch (error) {
      yield {
        type: "error",
        errorMessage: error instanceof Error ? error.message : "Model stream failed.",
      };
    }
  }

  private assertTextOnly(options?: ModelCallOptions): void {
    if (options?.tools?.length) {
      throw new Error(
        "OpenAICompatibleModelAdapter does not support tool execution yet. Omit ModelCallOptions.tools for now.",
      );
    }

    if (options?.responseFormat?.type === "json") {
      throw new Error(
        'OpenAICompatibleModelAdapter currently supports text output only. JSON responseFormat is not implemented yet.',
      );
    }
  }

  private buildProviderSettings(): OpenAICompatibleProviderSettings {
    const baseURL = getRelayBaseUrl(this.relay);
    const apiKey = getRelayApiKey(this.relay, this.apiKey);

    return {
      name: this.relay.displayName ?? "digital-self-relay",
      baseURL,
      apiKey,
      headers: this.relay.defaultHeaders,
      queryParams: this.relay.defaultQuery,
    };
  }
}

export function getRelayBaseUrl(relay: ModelRelayConfig): string {
  const baseUrl = relay.baseURL ?? relay.baseUrl;

  if (!baseUrl) {
    throw new Error(
      `Model relay "${relay.modelId}" is missing baseUrl/baseURL for provider "${relay.provider}".`,
    );
  }

  return baseUrl;
}

export function getRelayApiKey(relay: ModelRelayConfig, explicitApiKey?: string): string {
  if (explicitApiKey) {
    return explicitApiKey;
  }
  if (!relay.apiKeyEnvVar) {
    throw new Error(
      `Model relay "${relay.modelId}" is missing apiKeyEnvVar for provider "${relay.provider}".`,
    );
  }

  const apiKey = process.env[relay.apiKeyEnvVar];

  if (!apiKey) {
    throw new Error(
      `Environment variable "${relay.apiKeyEnvVar}" is required for model relay "${relay.modelId}" but is not set.`,
    );
  }

  return apiKey;
}

export function toAiSdkModelMessages(
  messages: ModelMessage[],
): AiSdkModelMessage[] {
  return messages.map((message) => {
    switch (message.role) {
      case "system":
        return {
          role: "system",
          content: message.content,
        } satisfies SystemModelMessage;
      case "user":
        return {
          role: "user",
          content: message.content,
        } satisfies UserModelMessage;
      case "assistant":
        return {
          role: "assistant",
          content: message.content,
        } satisfies AssistantModelMessage;
      case "tool":
        return toAiSdkToolMessage(message);
      default:
        throw new Error(`Unsupported model message role: ${String(message.role)}`);
    }
  });
}

function toAiSdkToolMessage(message: ModelMessage): ToolModelMessage {
  if (!message.name) {
    throw new Error(
      "Tool role messages require ModelMessage.name to map to AI SDK tool messages.",
    );
  }

  if (!message.toolCallId) {
    throw new Error(
      "Tool role messages require ModelMessage.toolCallId to map to AI SDK tool messages.",
    );
  }

  return {
    role: "tool",
    content: [
      {
        type: "tool-result",
        toolName: message.name,
        toolCallId: message.toolCallId,
        output: parseToolOutput(message.content),
      },
    ],
  };
}

function parseToolOutput(content: string):
  | { type: "text"; value: string }
  | { type: "json"; value: JSONValue } {
  try {
    return {
      type: "json",
      value: JSON.parse(content) as JSONValue,
    };
  } catch {
    return {
      type: "text",
      value: content,
    };
  }
}

function normalizeFinishReason(
  finishReason: string | undefined,
): ModelResponse["finishReason"] | undefined {
  switch (finishReason) {
    case "stop":
    case "length":
    case "tool-calls":
    case "content-filter":
    case "error":
      return finishReason;
    default:
      return undefined;
  }
}

function mapToolCall(toolCall: {
  toolCallId: string;
  toolName: string;
  input: unknown;
}): ModelToolCall {
  return {
    id: toolCall.toolCallId,
    toolName: toolCall.toolName,
    input:
      isRecord(toolCall.input) ? toolCall.input : { value: toolCall.input },
  };
}

function mapUsage(
  usage:
    | {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
      }
    | undefined,
): ModelUsage | undefined {
  if (!usage) {
    return undefined;
  }

  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
