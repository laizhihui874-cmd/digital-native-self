import type {
  CitationSourceType,
  CreateMemoryRequest,
  ListMemoriesResponse,
  ListMemoriesQuery,
  Memory,
  ReviewMemoryRequest,
} from "@digital-self/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { contentHash, deterministicMemoryEmbeddingModel } from "./deterministic-memory-rag";
import { mapMemory, mapMemoryArchiveDetail, memoryArchiveInclude } from "./memory.mapper";

@Injectable()
export class MemoriesRepository {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async create(
    userId: string,
    input: Required<Pick<CreateMemoryRequest, "memoryType" | "content" | "status" | "isMomentaryThought">> &
      Pick<CreateMemoryRequest, "sourceCitationId" | "confidence" | "expiresAt">,
  ) {
    const memory = await this.prisma.memory.create({
      data: {
        userId,
        memoryType: input.memoryType,
        content: input.content,
        sourceCitationId: input.sourceCitationId,
        status: input.status,
        confidence: input.confidence,
        isMomentaryThought: input.isMomentaryThought,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });

    return mapMemory(memory);
  }

  async findById(userId: string, id: string) {
    const memory = await this.prisma.memory.findFirst({
      where: {
        id,
        userId,
      },
    });

    return memory ? mapMemory(memory) : null;
  }

  async findArchiveDetail(userId: string, id: string) {
    const memory = await this.prisma.memory.findFirst({
      where: { id, userId },
      include: memoryArchiveInclude,
    });
    return memory ? mapMemoryArchiveDetail(memory) : null;
  }

  async findExistingCandidateOrConfirmedByContents(userId: string, contents: string[]) {
    if (contents.length === 0) {
      return [];
    }

    return this.prisma.memory.findMany({
      where: {
        userId,
        status: {
          in: ["candidate", "confirmed"],
        },
        content: {
          in: contents,
        },
      },
      select: {
        id: true,
        content: true,
        status: true,
      },
    });
  }

  async findSourceCitationBySource(sourceType: CitationSourceType, sourceId: string) {
    return this.prisma.sourceCitation.findFirst({
      where: {
        sourceType,
        sourceId,
      },
      select: {
        id: true,
      },
    });
  }

  async createSourceCitation(input: {
    sourceType: CitationSourceType;
    sourceId: string;
    title?: string | null;
    excerpt?: string | null;
    locator?: string | null;
  }) {
    return this.prisma.sourceCitation.create({
      data: {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        title: input.title,
        excerpt: input.excerpt,
        locator: input.locator,
      },
      select: {
        id: true,
      },
    });
  }

  async list(params: {
    userId: string;
    status?: ListMemoriesQuery["status"];
    memoryType?: ListMemoriesQuery["memoryType"];
    limit: number;
    offset: number;
  }): Promise<ListMemoriesResponse> {
    const where = buildListWhereInput(params.userId, params.status, params.memoryType);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.memory.count({ where }),
      this.prisma.memory.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip: params.offset,
        take: params.limit,
      }),
    ]);

    return {
      items: items.map(mapMemory),
      pagination: {
        limit: params.limit,
        offset: params.offset,
        total,
      },
    };
  }

  async listConfirmedForRetrieval(userId: string): Promise<Memory[]> {
    const memories = await this.prisma.memory.findMany({
      where: {
        userId,
        status: "confirmed",
        expiresAt: {
          equals: null,
        },
      },
      orderBy: [{ updatedAt: "desc" }],
    });

    return memories.map(mapMemory);
  }

  async ensureMemoryEmbeddings(memories: Memory[]): Promise<number> {
    let changedCount = 0;

    for (const memory of memories) {
      const hash = contentHash(memory.content);
      const existing = await this.prisma.embedding.findUnique({
        where: {
          sourceType_sourceId_chunkIndex: {
            sourceType: "memory",
            sourceId: memory.id,
            chunkIndex: 0,
          },
        },
        select: {
          contentHash: true,
        },
      });

      if (existing?.contentHash === hash) {
        continue;
      }

      await this.prisma.embedding.upsert({
        where: {
          sourceType_sourceId_chunkIndex: {
            sourceType: "memory",
            sourceId: memory.id,
            chunkIndex: 0,
          },
        },
        update: {
          content: memory.content,
          embeddingModel: deterministicMemoryEmbeddingModel,
          dimensions: null,
          contentHash: hash,
        },
        create: {
          sourceType: "memory",
          sourceId: memory.id,
          chunkIndex: 0,
          content: memory.content,
          embeddingModel: deterministicMemoryEmbeddingModel,
          dimensions: null,
          contentHash: hash,
        },
      });
      changedCount += 1;
    }

    return changedCount;
  }

  async review(
    userId: string,
    id: string,
    input: ReviewMemoryRequest,
  ) {
    const memory = await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.memory.findFirst({
        where: {
          id,
          userId,
        },
      });

      if (!existing) {
        return null;
      }

      const nextContent = input.content ?? existing.content;

      if (input.content && input.content !== existing.content) {
        await transaction.memoryVersion.create({
          data: {
            memoryId: existing.id,
            previousContent: existing.content,
            newContent: nextContent,
            changeReason: input.changeReason,
            changedBy: "user",
          },
        });
      }

      return transaction.memory.update({
        where: { id: existing.id },
        data: {
          content: nextContent,
          memoryType: input.memoryType ?? existing.memoryType,
          status: input.status,
          isMomentaryThought: input.isMomentaryThought ?? existing.isMomentaryThought,
          expiresAt:
            input.expiresAt === undefined
              ? existing.expiresAt
              : input.expiresAt
                ? new Date(input.expiresAt)
                : null,
        },
      });
    });

    return memory ? mapMemory(memory) : null;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.memory.deleteMany({
      where: {
        id,
        userId,
      },
    });

    return result.count > 0;
  }
}

function buildListWhereInput(
  userId: string,
  status?: ListMemoriesQuery["status"],
  memoryType?: ListMemoriesQuery["memoryType"],
): Prisma.MemoryWhereInput {
  return {
    userId,
    status,
    memoryType,
  };
}
