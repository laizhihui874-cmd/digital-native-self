import type {
  ModelAdapter,
  ModelCallOptions,
  ModelCapabilities,
  ModelMessage,
  ModelRelayConfig,
  ModelResponse,
  StaticModelAdapterOptions,
} from "./model-adapter";

const DEFAULT_STATIC_CAPABILITIES: ModelCapabilities = {
  supportsStreaming: false,
  supportsSystemMessage: true,
  supportsStructuredOutput: "text-only",
  supportsToolCalling: "none",
  supportsReasoningTokens: false,
  supportsOpenAiCompatibleRelay: false,
  inputModalities: ["text"],
  outputModalities: ["text"],
};

const DEFAULT_STATIC_RELAY: ModelRelayConfig = {
  provider: "custom",
  modelId: "static-model",
  displayName: "Static Model Adapter",
};

export class StaticModelAdapter implements ModelAdapter {
  readonly relay: ModelRelayConfig;
  private readonly response?: ModelResponse | string;
  private readonly generateResult?: StaticModelAdapterOptions["generateResult"];
  private readonly capabilities: ModelCapabilities;

  constructor(options: StaticModelAdapterOptions = {}) {
    this.relay = options.relay ?? DEFAULT_STATIC_RELAY;
    this.response = options.response;
    this.generateResult = options.generateResult;
    this.capabilities = {
      ...DEFAULT_STATIC_CAPABILITIES,
      ...options.capabilities,
    };
  }

  getCapabilities(): ModelCapabilities {
    return {
      ...this.capabilities,
    };
  }

  async generate(
    messages: ModelMessage[],
    options?: ModelCallOptions,
  ): Promise<ModelResponse> {
    const generated =
      (await this.generateResult?.(messages, options)) ?? this.response ?? "";

    return typeof generated === "string"
      ? {
          modelId: this.relay.modelId,
          text: generated,
          finishReason: "stop",
        }
      : {
          ...generated,
          modelId: generated.modelId || this.relay.modelId,
        };
  }
}
