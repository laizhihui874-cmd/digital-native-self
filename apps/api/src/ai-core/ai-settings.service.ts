import type { AiSettings, TestAiSettingsResponse, UpdateAiSettingsRequest } from "@digital-self/shared";
import { BadRequestException, ForbiddenException, HttpException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { AiSettings as PrismaAiSettings } from "@prisma/client";

import { DefaultIdentityService } from "../identity/default-identity.service";
import { PrismaService } from "../prisma/prisma.service";
import { AiModelGateway, normalizeAiProviderError } from "./ai-model.gateway";
import { CredentialStoreService } from "./credential-store.service";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_FAST_MODEL = "gpt-4.1-mini";
const DEFAULT_ANALYSIS_MODEL = "gpt-4.1";

export type AiRuntimeSettings = {
  baseUrl: string;
  fastModel: string;
  analysisModel: string;
  apiKey: string;
};

@Injectable()
export class AiSettingsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DefaultIdentityService) private readonly identity: DefaultIdentityService,
    @Inject(CredentialStoreService) private readonly credentials: CredentialStoreService,
    @Inject(AiModelGateway) private readonly models: AiModelGateway,
  ) {}

  async get(): Promise<AiSettings> {
    const userId = await this.identity.getCurrentUserId();
    return this.toView(userId, await this.prisma.aiSettings.findUnique({ where: { userId } }));
  }

  async update(input: UpdateAiSettingsRequest): Promise<AiSettings> {
    const userId = await this.identity.getCurrentUserId();
    const current = await this.prisma.aiSettings.findUnique({ where: { userId } });
    const baseUrl = validateBaseUrl(input.baseUrl);
    const fastModel = input.fastModel.trim();
    const analysisModel = input.analysisModel.trim();
    let credentialRef = current?.credentialRef ?? null;

    if (input.apiKey?.trim()) credentialRef = await this.credentials.save(userId, input.apiKey);
    if (input.removeCredential || !input.externalProcessingConsent) {
      await this.credentials.delete(userId, credentialRef);
      credentialRef = null;
    }

    const available = await this.credentials.read(userId, credentialRef);
    if (input.enabled && !input.externalProcessingConsent) {
      throw new BadRequestException("启用 AI 前需要同意必要资料发送到所配置的模型服务。");
    }
    if (input.enabled && !available.apiKey) {
      throw new BadRequestException("启用 AI 前需要提供 API 密钥。");
    }

    const record = await this.prisma.aiSettings.upsert({
      where: { userId },
      update: {
        baseUrl,
        fastModel,
        analysisModel,
        credentialRef,
        enabled: input.enabled,
        externalProcessingConsentAt: input.externalProcessingConsent
          ? current?.externalProcessingConsentAt ?? new Date()
          : null,
      },
      create: {
        userId,
        baseUrl,
        fastModel,
        analysisModel,
        credentialRef,
        enabled: input.enabled,
        externalProcessingConsentAt: input.externalProcessingConsent ? new Date() : null,
      },
    });
    return this.toView(userId, record);
  }

  async test(slot: "fast" | "analysis" = "fast"): Promise<TestAiSettingsResponse> {
    const runtime = await this.requireRuntime();
    const startedAt = Date.now();
    try {
      const response = await this.models.generate(runtime, slot, [
        { role: "system", content: "只回复 OK，不要输出其他内容。" },
        { role: "user", content: "连接测试" },
      ], { maxOutputTokens: 8, temperature: 0 });
      return {
        ok: true,
        slot,
        model: response.modelId,
        latencyMs: Date.now() - startedAt,
        usage: response.usage,
        result: response.text,
      };
    } catch (error) {
      const normalized = normalizeAiProviderError(error);
      throw new HttpException({ message: normalized.safeMessage, code: normalized.code, slot }, normalized.httpStatus);
    }
  }

  async delete(): Promise<number> {
    const userId = await this.identity.getCurrentUserId();
    const current = await this.prisma.aiSettings.findUnique({ where: { userId } });
    if (!current) return 0;
    await this.credentials.delete(userId, current.credentialRef);
    return (await this.prisma.aiSettings.deleteMany({ where: { userId } })).count;
  }

  async requireRuntime(): Promise<AiRuntimeSettings> {
    const userId = await this.identity.getCurrentUserId();
    const settings = await this.prisma.aiSettings.findUnique({ where: { userId } });
    if (!settings?.enabled || !settings.externalProcessingConsentAt) {
      throw new ForbiddenException("AI 云端处理权限未启用。");
    }
    const credential = await this.credentials.read(userId, settings.credentialRef);
    if (!credential.apiKey) throw new ServiceUnavailableException("没有找到可用的 AI API 密钥。");
    return {
      baseUrl: settings.baseUrl,
      fastModel: settings.fastModel,
      analysisModel: settings.analysisModel,
      apiKey: credential.apiKey,
    };
  }

  private async toView(userId: string, record: PrismaAiSettings | null): Promise<AiSettings> {
    const credential = await this.credentials.read(userId, record?.credentialRef);
    return {
      baseUrl: record?.baseUrl ?? DEFAULT_BASE_URL,
      fastModel: record?.fastModel ?? DEFAULT_FAST_MODEL,
      analysisModel: record?.analysisModel ?? DEFAULT_ANALYSIS_MODEL,
      enabled: record?.enabled ?? false,
      externalProcessingConsentAt: record?.externalProcessingConsentAt?.toISOString() ?? null,
      hasCredential: Boolean(credential.apiKey),
      credentialSource: credential.source,
    };
  }
}

function validateBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new BadRequestException("服务地址必须是有效的 URL。");
  }
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1";
  if (url.username || url.password || (url.protocol !== "https:" && !(loopback && url.protocol === "http:"))) {
    throw new BadRequestException("服务地址需要使用 HTTPS；本机 loopback 服务可以使用 HTTP，地址中不能包含账号或密钥。");
  }
  return url.toString().replace(/\/$/, "");
}
