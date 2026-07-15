import type {
  ImportedFile,
  ListImportedFilesQuery,
  ListImportedFilesResponse,
  RegisterImportedFileRequest,
} from "@digital-self/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { mapImportedFile } from "./imported-file.mapper";

@Injectable()
export class ImportedFilesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(userId: string, input: RegisterImportedFileRequest): Promise<ImportedFile> {
    const record = await this.prisma.importedFile.create({
      data: {
        userId,
        fileName: input.fileName,
        fileType: input.fileType,
        sourceType: input.sourceType,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes,
        contentHash: input.contentHash,
        storagePath: input.storagePath,
        parsedText: input.parsedText,
        parseStatus: input.parseStatus ?? "pending",
        parseError: input.parseError,
      },
    });

    return mapImportedFile(record);
  }

  async list(params: {
    userId: string;
    limit: number;
    offset: number;
    sourceType?: ListImportedFilesQuery["sourceType"];
  }): Promise<ListImportedFilesResponse> {
    const where = buildListWhereInput(params.userId, params.sourceType);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.importedFile.count({ where }),
      this.prisma.importedFile.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: params.offset,
        take: params.limit,
      }),
    ]);

    return {
      items: items.map(mapImportedFile),
      pagination: {
        limit: params.limit,
        offset: params.offset,
        total,
      },
    };
  }

  async findById(userId: string, id: string): Promise<ImportedFile | null> {
    const record = await this.prisma.importedFile.findFirst({
      where: {
        id,
        userId,
      },
    });

    return record ? mapImportedFile(record) : null;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.importedFile.deleteMany({
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
  sourceType?: ListImportedFilesQuery["sourceType"],
): Prisma.ImportedFileWhereInput {
  return {
    userId,
    ...(sourceType !== undefined ? { sourceType } : {}),
  };
}
