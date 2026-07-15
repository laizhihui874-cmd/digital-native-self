import type { ModelCallOptions, ModelMessage, ModelResponse, ModelStreamEvent } from "@digital-self/agent";
import { OpenAICompatibleModelAdapter } from "@digital-self/agent";
import { Injectable } from "@nestjs/common";

import type { AiRuntimeSettings } from "./ai-settings.service";

const MODEL_TIMEOUT_MS = Number(process.env.AI_MODEL_TIMEOUT_MS || 60_000);
const failedStreamQuestions = new Set<string>();

export type AiProviderErrorCode =
  | "credential_error"
  | "model_not_found"
  | "rate_limited"
  | "timeout"
  | "service_unavailable"
  | "response_incompatible"
  | "stream_incompatible";

export class AiProviderError extends Error {
  constructor(
    readonly code: AiProviderErrorCode,
    readonly safeMessage: string,
    readonly httpStatus: number,
    options?: { cause?: unknown },
  ) {
    super(safeMessage, options);
    this.name = "AiProviderError";
  }
}

@Injectable()
export class AiModelGateway {
  async generate(
    settings: AiRuntimeSettings,
    slot: "fast" | "analysis",
    messages: ModelMessage[],
    options?: ModelCallOptions,
  ): Promise<ModelResponse> {
    const modelId = slot === "fast" ? settings.fastModel : settings.analysisModel;
    try {
      const response = process.env.AI_ASSISTANT_PROVIDER === "fake"
        ? await fakeResponse(modelId, messages)
        : await withTimeout(this.adapter(settings, modelId).generate(messages, options), MODEL_TIMEOUT_MS);
      if (!response || typeof response.text !== "string" || !response.text.trim()) {
        throw new AiProviderError("response_incompatible", "模型返回了空内容或无法识别的响应格式。", 502);
      }
      return response;
    } catch (error) {
      throw normalizeAiProviderError(error);
    }
  }

  async *stream(
    settings: AiRuntimeSettings,
    messages: ModelMessage[],
    options?: ModelCallOptions,
  ): AsyncIterable<ModelStreamEvent> {
    if (process.env.AI_ASSISTANT_PROVIDER === "fake") {
      const lastUser = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
      const firstModelFailure = lastUser.includes("验收模型失败") && !failedStreamQuestions.has(lastUser);
      if (process.env.NODE_ENV === "test" && (firstModelFailure || lastUser.includes("验收断流"))) {
        if (firstModelFailure) failedStreamQuestions.add(lastUser);
        if (lastUser.includes("验收断流")) yield { type: "text-delta", textDelta: "未完成的回答" };
        const error = new AiProviderError("stream_incompatible", "模型流式响应中断或格式不兼容。", 502);
        yield { type: "error", errorMessage: `${error.code}:${error.safeMessage}` };
        return;
      }
      if (process.env.NODE_ENV === "test" && lastUser.includes("验收空响应")) {
        yield { type: "response-complete", response: { modelId: settings.analysisModel, text: "", finishReason: "stop" } };
        return;
      }
      const response = await fakeResponse(settings.analysisModel, messages);
      for (const part of chunkText(response.text, 18)) {
        yield { type: "text-delta", textDelta: part };
      }
      yield { type: "response-complete", response };
      return;
    }
    const adapter = this.adapter(settings, settings.analysisModel);
    if (!adapter.stream) throw new AiProviderError("stream_incompatible", "当前服务不支持兼容的流式回答。", 502);
    const iterator = adapter.stream(messages, options)[Symbol.asyncIterator]();
    try {
      while (true) {
        const next = await withTimeout(iterator.next(), MODEL_TIMEOUT_MS);
        if (next.done) break;
        if (next.value.type === "error") throw normalizeAiProviderError(next.value.errorMessage, "stream");
        yield next.value;
      }
    } catch (error) {
      const normalized = normalizeAiProviderError(error, "stream");
      yield { type: "error", errorMessage: `${normalized.code}:${normalized.safeMessage}` };
    } finally {
      await iterator.return?.();
    }
  }

  private adapter(settings: AiRuntimeSettings, modelId: string): OpenAICompatibleModelAdapter {
    return new OpenAICompatibleModelAdapter(
      { provider: "openai-compatible", baseURL: settings.baseUrl, modelId, displayName: "digital-self-ai" },
      { apiKey: settings.apiKey },
    );
  }
}

async function fakeResponse(modelId: string, messages: ModelMessage[]): Promise<ModelResponse> {
  if (modelId.includes("error-401")) throw Object.assign(new Error("Incorrect API key"), { statusCode: 401 });
  if (modelId.includes("error-404")) throw Object.assign(new Error("Model not found"), { statusCode: 404 });
  if (modelId.includes("error-429")) throw Object.assign(new Error("Rate limit exceeded"), { statusCode: 429 });
  if (modelId.includes("error-503")) throw Object.assign(new Error("Service unavailable"), { statusCode: 503 });
  if (modelId.includes("error-timeout")) throw Object.assign(new Error("Request timed out"), { code: "ETIMEDOUT" });
  if (modelId.includes("error-format")) return { modelId, text: "", finishReason: "stop" };
  const system = messages.find((message) => message.role === "system")?.content ?? "";
  const user = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
  if (system.includes("检索扩词")) {
    const terms = user.includes("跳槽") ? ["换工作", "离职", "职业选择"] : [];
    return { modelId, text: JSON.stringify({ terms }), finishReason: "stop", usage: { inputTokens: 12, outputTokens: 8, totalTokens: 20 } };
  }
  if (user === "连接测试") return { modelId, text: "OK", finishReason: "stop", usage: { inputTokens: 6, outputTokens: 1, totalTokens: 7 } };
  if (process.env.NODE_ENV === "test" && user.includes("验收虚构引用")) {
    return { modelId, text: "档案内容：这是一条不存在的引用 [[S999]]。", finishReason: "stop", usage: { inputTokens: 20, outputTokens: 12, totalTokens: 32 } };
  }
  const markers = Array.from(system.matchAll(/citation_id="(S\d+)"/g), (match) => match[1]);
  const text = markers.length
    ? `档案内容：检索到的记录提供了与问题相关的线索 [[${markers[0]}]]。\n\nAI 解释：这些资料只能说明已经记录下来的部分，不能代替你的判断。\n\n建议：先核对来源，再决定下一步。`
    : "资料不足：当前没有找到足以支持回答的档案记录。请补充人物、时间或更具体的关键词。";
  return { modelId, text, finishReason: "stop", usage: { inputTokens: 80, outputTokens: 50, totalTokens: 130 } };
}

export function normalizeAiProviderError(error: unknown, phase: "generate" | "stream" = "generate"): AiProviderError {
  if (error instanceof AiProviderError) return error;
  const record = isRecord(error) ? error : {};
  const status = numberValue(record.statusCode) ?? numberValue(record.status);
  const rawMessage = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const message = rawMessage.toLowerCase();
  const code = typeof record.code === "string" ? record.code.toUpperCase() : "";
  if (status === 401 || status === 403 || /api.?key|unauthori|credential|authentication/.test(message)) {
    return new AiProviderError("credential_error", "API 密钥无效、已过期或没有访问权限。", 401, { cause: error });
  }
  if (status === 404 || /model.+not found|unknown model|does not exist/.test(message)) {
    return new AiProviderError("model_not_found", "配置的模型不存在，或当前密钥无权使用该模型。", 404, { cause: error });
  }
  if (status === 429 || /rate.?limit|too many requests|quota/.test(message)) {
    return new AiProviderError("rate_limited", "模型服务当前限流或额度不足，请稍后重试并检查账户额度。", 429, { cause: error });
  }
  if (code === "ETIMEDOUT" || code === "ABORT_ERR" || /timed? ?out|timeout|aborted/.test(message)) {
    return new AiProviderError("timeout", "模型服务在等待时间内没有返回结果。", 504, { cause: error });
  }
  if (status === 502 || status === 503 || status === 504 || /econnrefused|enotfound|network|fetch failed|service unavailable|connection/.test(message)) {
    return new AiProviderError("service_unavailable", "模型服务当前不可用，请检查服务地址和网络连接。", 503, { cause: error });
  }
  if (phase === "stream" || /stream|sse|chunk|unexpected end/.test(message)) {
    return new AiProviderError("stream_incompatible", "模型流式响应中断或格式不兼容。", 502, { cause: error });
  }
  return new AiProviderError("response_incompatible", "模型响应格式与当前 OpenAI 兼容接口不一致。", 502, { cause: error });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("Model request timeout"), { code: "ETIMEDOUT" })), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function chunkText(value: string, size: number): string[] {
  const result: string[] = [];
  for (let index = 0; index < value.length; index += size) result.push(value.slice(index, index + size));
  return result;
}
