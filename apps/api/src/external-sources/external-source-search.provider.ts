import type {
  ExternalSourceSearchCategory,
  SearchExternalSourceItem,
} from "@digital-self/shared";
import { BadGatewayException, Injectable } from "@nestjs/common";

import { assertExternalProcessingAllowed } from "../data-control/external-processing-policy";

const DEFAULT_TIMEOUT_MS = 8_000;

export type ExternalSourceSearchProviderResult = {
  provider: string;
  searchMode: "fake" | "best_effort_web";
  items: SearchExternalSourceItem[];
};

export type ExternalSourceSearchProviderInput = {
  query: string;
  category: ExternalSourceSearchCategory;
  limit: number;
};

@Injectable()
export class ExternalSourceSearchProvider {
  async search(input: ExternalSourceSearchProviderInput): Promise<ExternalSourceSearchProviderResult> {
    const providerName = process.env.EXTERNAL_SOURCE_SEARCH_PROVIDER ?? "duckduckgo";

    if (providerName === "fake") {
      return {
        provider: "fake",
        searchMode: "fake",
        items: buildFakeItems(input),
      };
    }

    assertExternalProcessingAllowed("External web search");

    return this.searchDuckDuckGo(input);
  }

  private async searchDuckDuckGo(
    input: ExternalSourceSearchProviderInput,
  ): Promise<ExternalSourceSearchProviderResult> {
    const query = buildSearchQuery(input.query, input.category);
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    let html: string;
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "digital-self-mvp/0.1 best-effort-research",
        },
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`DuckDuckGo returned ${response.status}`);
      }

      html = await response.text();
    } catch (error) {
      throw new BadGatewayException(
        `External source search failed in best-effort web mode: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const items = parseDuckDuckGoHtml(html, input.limit);

    return {
      provider: "duckduckgo-html",
      searchMode: "best_effort_web",
      items,
    };
  }
}

function buildFakeItems(input: ExternalSourceSearchProviderInput): SearchExternalSourceItem[] {
  const categoryLabelMap: Record<ExternalSourceSearchCategory, string> = {
    ai_role: "AI 应用开发岗位要求",
    job_market: "广州深圳岗位行情",
    industry: "行业趋势与就业前景",
    postgraduate: "华南师范大学外国哲学考研信息",
    other: "外部信息",
  };

  return Array.from({ length: Math.min(input.limit, 3) }, (_, index) => {
    const position = index + 1;
    return {
      title: `${categoryLabelMap[input.category]}：${input.query} 样例来源 ${position}`,
      sourceSite: "Fake Search Provider",
      url: `https://example.com/digital-self-search/${input.category}/${position}`,
      summary: `本条为 fake provider 生成的验收样例，用于验证「${input.query}」搜索结果保存链路。`,
      relationToDecision:
        "仅用于本地自动化验收，不代表真实外部研究结论；真实使用时需要切换 best-effort web provider 并人工核对来源。",
    };
  });
}

function buildSearchQuery(query: string, category: ExternalSourceSearchCategory): string {
  const categorySuffixMap: Record<ExternalSourceSearchCategory, string> = {
    ai_role: "AI 应用工程师 岗位要求 JD",
    job_market: "广州 深圳 AI 应用开发 薪资 招聘",
    industry: "AI 应用开发 行业趋势 就业前景",
    postgraduate: "华南师范大学 外国哲学 考研 招生",
    other: "",
  };

  return [query, categorySuffixMap[category]].filter(Boolean).join(" ");
}

function parseDuckDuckGoHtml(html: string, limit: number): SearchExternalSourceItem[] {
  const resultPattern =
    /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  const items: SearchExternalSourceItem[] = [];
  const seenUrls = new Set<string>();

  for (const match of html.matchAll(resultPattern)) {
    const url = normalizeDuckDuckGoUrl(decodeHtml(match[1] ?? ""));
    const title = cleanHtmlText(match[2] ?? "");
    const summary = cleanHtmlText(match[3] ?? "");

    if (!url || !title || seenUrls.has(url)) {
      continue;
    }

    seenUrls.add(url);
    items.push({
      title,
      sourceSite: resolveHostname(url),
      url,
      summary: summary || null,
      relationToDecision:
        "best-effort web search result; 保存前未经过模型深度研究，需用户打开来源自行核对。",
    });

    if (items.length >= limit) {
      break;
    }
  }

  return items;
}

function normalizeDuckDuckGoUrl(value: string): string | null {
  try {
    if (value.startsWith("//duckduckgo.com/l/?")) {
      const parsed = new URL(`https:${value}`);
      const uddg = parsed.searchParams.get("uddg");
      return uddg && isHttpUrl(uddg) ? uddg : null;
    }

    if (value.startsWith("/l/?")) {
      const parsed = new URL(`https://duckduckgo.com${value}`);
      const uddg = parsed.searchParams.get("uddg");
      return uddg && isHttpUrl(uddg) ? uddg : null;
    }

    return isHttpUrl(value) ? value : null;
  } catch {
    return null;
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function resolveHostname(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "Unknown Source";
  }
}

function cleanHtmlText(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
