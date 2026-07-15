import type { ImportedFile as PrismaImportedFile } from "@prisma/client";
import type { ImportedFile } from "@digital-self/shared";

export function mapImportedFile(record: PrismaImportedFile): ImportedFile {
  return {
    id: record.id,
    userId: record.userId,
    fileName: record.fileName,
    fileType: record.fileType,
    sourceType: record.sourceType,
    mimeType: record.mimeType,
    fileSizeBytes: record.fileSizeBytes,
    contentHash: record.contentHash,
    storagePath: record.storagePath,
    parsedText: record.parsedText,
    parseStatus: record.parseStatus,
    parseError: record.parseError,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
