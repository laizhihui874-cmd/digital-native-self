import { createHash } from "node:crypto";

import type { AiMessageCitation, ArchiveSearchHit, SourceCitation } from "@digital-self/shared";
import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SourceCitationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async saveMessageCitations(input: {
    userId: string;
    messageId: string;
    sentHits: ArchiveSearchHit[];
    referencedMarkers: Set<string>;
  }): Promise<AiMessageCitation[]> {
    const result: AiMessageCitation[] = [];
    for (const hit of input.sentHits) {
      const contentHash = createHash("sha256").update(`${hit.sourceType}:${hit.sourceId}:${hit.sourceVersionId ?? ""}:${hit.excerpt}`).digest("hex");
      let citation = await this.prisma.sourceCitation.findFirst({
        where: { userId: input.userId, sourceType: hit.sourceType, sourceId: hit.sourceId, sourceVersionId: hit.sourceVersionId ?? null, contentHash },
      });
      citation ??= await this.prisma.sourceCitation.create({
        data: {
          userId: input.userId,
          sourceType: hit.sourceType,
          sourceId: hit.sourceId,
          sourceVersionId: hit.sourceVersionId,
          contentHash,
          title: hit.title,
          excerpt: hit.excerpt,
          locator: hit.locator,
          metadata: { sourcePath: hit.sourcePath, occurredAt: hit.occurredAt, searchMarker: hit.citationId },
        },
      });
      await this.prisma.citationUse.create({ data: { citationId: citation.id, consumerType: "ai_message", consumerId: input.messageId, purpose: "context" } });
      if (input.referencedMarkers.has(hit.citationId)) {
        await this.prisma.citationUse.create({ data: { citationId: citation.id, consumerType: "ai_message", consumerId: input.messageId, purpose: "answer_support" } });
        result.push({ marker: hit.citationId, citation: mapCitation(citation), sourcePath: hit.sourcePath });
      }
    }
    return result;
  }
}

export function mapCitation(value: {
  id: string; userId: string | null; sourceType: SourceCitation["sourceType"]; sourceId: string; sourceVersionId: string | null; contentHash: string | null; title: string | null; url: string | null; excerpt: string | null; locator: string | null; metadata: unknown; createdAt: Date;
}): SourceCitation {
  return {
    id: value.id,
    userId: value.userId,
    sourceType: value.sourceType,
    sourceId: value.sourceId,
    sourceVersionId: value.sourceVersionId,
    contentHash: value.contentHash,
    title: value.title,
    url: value.url,
    excerpt: value.excerpt,
    locator: value.locator,
    metadata: isRecord(value.metadata) ? value.metadata : null,
    createdAt: value.createdAt.toISOString(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
