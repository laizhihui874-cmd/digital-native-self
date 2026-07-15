import type { ArchiveSearchRequest, ArchiveSearchResponse } from "@digital-self/shared";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { AiModelGateway } from "../ai-core/ai-model.gateway";
import { AiSettingsService } from "../ai-core/ai-settings.service";
import { DefaultIdentityService } from "../identity/default-identity.service";
import { PrismaService } from "../prisma/prisma.service";
import { ArchiveSearchRepository } from "./archive-search.repository";
import { normalizeSearchText, rankSearchDocuments } from "./archive-search.ranker";

@Injectable()
export class ArchiveSearchService {
  constructor(
    @Inject(ArchiveSearchRepository) private readonly repository: ArchiveSearchRepository,
    @Inject(DefaultIdentityService) private readonly identity: DefaultIdentityService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiSettingsService) private readonly settings: AiSettingsService,
    @Inject(AiModelGateway) private readonly models: AiModelGateway,
  ) {}

  async search(input: ArchiveSearchRequest): Promise<ArchiveSearchResponse> {
    const query = input.query.trim();
    if (!query) throw new BadRequestException("Field 'query' must not be empty.");
    const userId = await this.identity.getCurrentUserId();
    if (input.context && !(await this.repository.contextExists(userId, input.context))) throw new NotFoundException("当前页面关联的档案不存在。");
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    const documents = await this.repository.collect(userId);
    const limit = input.limit ?? 12;
    const directHits = rankSearchDocuments({ query, documents, timeZone: user?.timezone ?? "Asia/Shanghai", context: input.context, limit });
    if (directHits.length >= 3 || input.allowExpansion === false) return { searchMode: "lexical", normalizedQuery: normalizeSearchText(query), expandedTerms: [], hits: directHits };

    const expandedTerms = await this.expandQuery(query);
    if (!expandedTerms.length) return { searchMode: "lexical", normalizedQuery: normalizeSearchText(query), expandedTerms: [], hits: directHits };
    const expandedHits = rankSearchDocuments({ query: `${query} ${expandedTerms.join(" ")}`, documents, timeZone: user?.timezone ?? "Asia/Shanghai", context: input.context, limit });
    return { searchMode: "lexical_expanded", normalizedQuery: normalizeSearchText(query), expandedTerms, hits: expandedHits };
  }

  private async expandQuery(query: string): Promise<string[]> {
    try {
      const runtime = await this.settings.requireRuntime();
      const response = await this.models.generate(runtime, "fast", [
        { role: "system", content: "你负责检索扩词。你只会收到用户问题，不会收到任何个人档案。返回 JSON：{\"terms\":[\"最多8个补充关键词\"]}。不要回答问题，不要添加说明。" },
        { role: "user", content: query },
      ], { temperature: 0, maxOutputTokens: 160 });
      const parsed = JSON.parse(stripCodeFence(response.text)) as { terms?: unknown };
      if (!Array.isArray(parsed.terms)) return [];
      return Array.from(new Set(parsed.terms.filter((term): term is string => typeof term === "string").map((term) => term.trim()).filter(Boolean))).slice(0, 8);
    } catch {
      return [];
    }
  }
}

function stripCodeFence(value: string): string { return value.trim().replace(/^```(?:json)?\s*/u, "").replace(/\s*```$/u, ""); }
