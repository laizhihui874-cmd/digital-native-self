import type { ResumeDocument as PrismaResumeDocument } from "@prisma/client";
import type { ResumeDocument } from "@digital-self/shared";

export function mapResumeDocument(record: PrismaResumeDocument): ResumeDocument {
  return {
    id: record.id,
    userId: record.userId,
    importedFileId: record.importedFileId,
    source: record.source,
    title: record.title,
    content: record.content,
    isPrimary: record.isPrimary,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
