import type {
  ListResumeDocumentsQuery,
  ListResumeDocumentsResponse,
  ResumeDocument,
  UpdateResumeDocumentRequest,
} from "@digital-self/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { mapResumeDocument } from "./resume-document.mapper";

@Injectable()
export class ResumeDocumentsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createText(userId: string, input: {
    title?: string;
    content: string;
    isPrimary: boolean;
  }): Promise<ResumeDocument> {
    const record = await this.prisma.$transaction(async (transaction) => {
      await unsetPrimaryIfNeeded(transaction, userId, input.isPrimary);

      return transaction.resumeDocument.create({
        data: {
          userId,
          source: "pasted",
          title: input.title,
          content: input.content,
          isPrimary: input.isPrimary,
        },
      });
    });

    return mapResumeDocument(record);
  }

  async createFromImportedFile(userId: string, input: {
    importedFileId: string;
    title?: string;
    content: string;
    isPrimary: boolean;
  }): Promise<ResumeDocument> {
    const record = await this.prisma.$transaction(async (transaction) => {
      await unsetPrimaryIfNeeded(transaction, userId, input.isPrimary);

      return transaction.resumeDocument.create({
        data: {
          userId,
          importedFileId: input.importedFileId,
          source: "uploaded",
          title: input.title,
          content: input.content,
          isPrimary: input.isPrimary,
        },
      });
    });

    return mapResumeDocument(record);
  }

  async list(params: {
    userId: string;
    limit: number;
    offset: number;
  }): Promise<ListResumeDocumentsResponse> {
    const where = buildListWhereInput(params.userId);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.resumeDocument.count({ where }),
      this.prisma.resumeDocument.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: params.offset,
        take: params.limit,
      }),
    ]);

    return {
      items: items.map(mapResumeDocument),
      pagination: {
        limit: params.limit,
        offset: params.offset,
        total,
      },
    };
  }

  async findById(userId: string, id: string): Promise<ResumeDocument | null> {
    const record = await this.prisma.resumeDocument.findFirst({
      where: {
        id,
        userId,
      },
    });

    return record ? mapResumeDocument(record) : null;
  }

  async update(
    userId: string,
    id: string,
    input: UpdateResumeDocumentRequest,
  ): Promise<ResumeDocument | null> {
    const record = await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.resumeDocument.findFirst({
        where: {
          id,
          userId,
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
        return null;
      }

      await unsetPrimaryIfNeeded(transaction, userId, input.isPrimary === true, existing.id);

      return transaction.resumeDocument.update({
        where: {
          id: existing.id,
        },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
        },
      });
    });

    return record ? mapResumeDocument(record) : null;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.resumeDocument.findFirst({
        where: {
          id,
          userId,
        },
        select: {
          id: true,
          importedFileId: true,
        },
      });

      if (!existing) {
        return false;
      }

      await transaction.resumeDocument.delete({
        where: {
          id: existing.id,
        },
      });

      if (existing.importedFileId) {
        const remainingCount = await transaction.resumeDocument.count({
          where: {
            importedFileId: existing.importedFileId,
          },
        });

        if (remainingCount === 0) {
          await transaction.importedFile.deleteMany({
            where: {
              id: existing.importedFileId,
              userId,
            },
          });
        }
      }

      return true;
    });
  }
}

function buildListWhereInput(userId: string): Prisma.ResumeDocumentWhereInput {
  return {
    userId,
  };
}

async function unsetPrimaryIfNeeded(
  transaction: Prisma.TransactionClient,
  userId: string,
  shouldUnset: boolean,
  excludeId?: string,
): Promise<void> {
  if (!shouldUnset) {
    return;
  }

  await transaction.resumeDocument.updateMany({
    where: {
      userId,
      isPrimary: true,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    data: {
      isPrimary: false,
    },
  });
}
