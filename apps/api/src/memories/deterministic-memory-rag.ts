import type { Memory } from "@digital-self/shared";
import { createHash } from "node:crypto";

export const deterministicMemoryEmbeddingModel = "deterministic-token-v1";

export type RankedMemoryInput = Memory;

export type RankedMemoryResult = {
  memory: RankedMemoryInput;
  score: number;
  matchedTerms: string[];
};

export function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function rankMemoriesByDeterministicSimilarity(
  query: string,
  memories: RankedMemoryInput[],
): RankedMemoryResult[] {
  const queryTokens = tokenize(query);

  return memories
    .map((memory) => {
      const memoryTokens = tokenize(memory.content);
      const matchedTerms = Array.from(
        new Set(queryTokens.filter((token) => memoryTokens.includes(token))),
      );
      const score =
        queryTokens.length === 0
          ? 0
          : matchedTerms.length / Math.max(queryTokens.length, memoryTokens.length, 1);

      return {
        memory,
        score,
        matchedTerms,
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);
}

export function tokenize(text: string): string[] {
  const normalized = text.toLowerCase();
  const asciiTokens = normalized.match(/[a-z0-9]{2,}/g) ?? [];
  const cjkTokens = normalized.match(/[\u4e00-\u9fff]{2}/g) ?? [];
  const words = normalized
    .split(/[\s,，。；;：:、/|()[\]{}"'`!?！？]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

  return Array.from(new Set([...asciiTokens, ...cjkTokens, ...words]));
}
