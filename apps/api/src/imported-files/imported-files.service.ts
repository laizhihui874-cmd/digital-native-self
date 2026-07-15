import type {
  CreateImportedFileTextRequest,
  ImportedFile,
  ImportedFileSourceType,
  ImportedFileType,
  ListImportedFilesResponse,
} from "@digital-self/shared";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { basename, extname } from "node:path";

import { DefaultIdentityService } from "../identity/default-identity.service";
import { ImportedFilesRepository } from "./imported-files.repository";
import { parseImportedFileText } from "./resume-file-parser";

export const MAX_IMPORTED_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORTED_RESUME_FILE_BYTES = MAX_IMPORTED_FILE_BYTES;

const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown"]);
const WORD_EXTENSIONS = new Set([".doc", ".docx"]);
const MARKDOWN_MIME_TYPES = new Set(["text/markdown", "text/x-markdown"]);
const WORD_MIME_TYPES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export type UploadedBinaryFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class ImportedFilesService {
  constructor(
    @Inject(ImportedFilesRepository)
    private readonly importedFilesRepository: ImportedFilesRepository,
    @Inject(DefaultIdentityService)
    private readonly identityService: DefaultIdentityService,
  ) {}

  async createResumeImportedFile(userId: string, file: UploadedBinaryFile): Promise<ImportedFile> {
    return this.createImportedFileFromUpload(userId, file, "resume");
  }

  async createHistoryText(input: CreateImportedFileTextRequest): Promise<ImportedFile> {
    const userId = await this.identityService.getCurrentUserId();
    const content = normalizeRequiredTextContent(input.content);
    const fileType = resolveImportedTextFileType(input.fileType, input.fileName);
    const normalizedFileName = normalizePastedFileName(input.fileName, fileType);
    const contentBuffer = Buffer.from(content, "utf8");

    return this.importedFilesRepository.create(userId, {
      fileName: normalizedFileName,
      fileType,
      sourceType: "history",
      mimeType: fileType === "markdown" ? "text/markdown" : "text/plain",
      fileSizeBytes: contentBuffer.length,
      contentHash: createHash("sha256").update(contentBuffer).digest("hex"),
      parsedText: content,
      parseStatus: "succeeded",
    });
  }

  async createHistoryImportedFile(file: UploadedBinaryFile): Promise<ImportedFile> {
    const userId = await this.identityService.getCurrentUserId();
    return this.createImportedFileFromUpload(userId, file, "history");
  }

  async list(query: {
    limit?: number;
    offset?: number;
    sourceType?: ImportedFileSourceType;
  }): Promise<ListImportedFilesResponse> {
    const userId = await this.identityService.getCurrentUserId();

    return this.importedFilesRepository.list({
      userId,
      limit: query.limit ?? DEFAULT_LIMIT,
      offset: query.offset ?? DEFAULT_OFFSET,
      sourceType: query.sourceType,
    });
  }

  async findById(id: string): Promise<ImportedFile> {
    const userId = await this.identityService.getCurrentUserId();
    const importedFile = await this.importedFilesRepository.findById(userId, id);

    if (!importedFile) {
      throw new NotFoundException(`ImportedFile ${id} was not found.`);
    }

    return importedFile;
  }

  async delete(id: string): Promise<void> {
    const userId = await this.identityService.getCurrentUserId();
    const deleted = await this.importedFilesRepository.delete(userId, id);

    if (!deleted) {
      throw new NotFoundException(`ImportedFile ${id} was not found.`);
    }
  }

  private async createImportedFileFromUpload(
    userId: string,
    file: UploadedBinaryFile,
    sourceType: ImportedFileSourceType,
  ): Promise<ImportedFile> {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException("A non-empty file upload is required.");
    }

    if (file.size > MAX_IMPORTED_FILE_BYTES) {
      throw new PayloadTooLargeException(
        `Uploaded file exceeds the ${MAX_IMPORTED_FILE_BYTES} byte limit.`,
      );
    }

    const fileType = resolveImportedFileType(file.originalname, file.mimetype);
    const parsedText = await parseImportedFileText(fileType, file.buffer);

    if (parsedText.trim().length === 0) {
      throw new BadRequestException("Uploaded file content must not be empty.");
    }

    return this.importedFilesRepository.create(userId, {
      fileName: normalizeUploadedFileName(file.originalname, sourceType),
      fileType,
      sourceType,
      mimeType: file.mimetype || undefined,
      fileSizeBytes: file.size,
      contentHash: createHash("sha256").update(file.buffer).digest("hex"),
      parsedText,
      parseStatus: "succeeded",
    });
  }
}

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

export function deriveTitleFromFileName(fileName: string): string | undefined {
  const trimmed = basename(fileName).trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  const extension = extname(trimmed);
  const rawTitle = extension.length > 0 ? trimmed.slice(0, -extension.length) : trimmed;
  const normalized = rawTitle.trim();

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeUploadedFileName(
  fileName: string,
  sourceType: ImportedFileSourceType,
): string {
  const trimmed = fileName.trim();
  if (trimmed.length > 0) {
    return trimmed;
  }

  return sourceType === "history" ? "history-import.txt" : "resume.txt";
}

function normalizePastedFileName(
  fileName: string | undefined,
  fileType: Extract<ImportedFileType, "txt" | "markdown">,
): string {
  const trimmed = fileName?.trim();

  if (trimmed && trimmed.length > 0) {
    return trimmed;
  }

  return fileType === "markdown" ? "history-paste.md" : "history-paste.txt";
}

function resolveImportedTextFileType(
  fileType: CreateImportedFileTextRequest["fileType"],
  fileName: string | undefined,
): Extract<ImportedFileType, "txt" | "markdown"> {
  if (fileType === "txt" || fileType === "markdown") {
    return fileType;
  }

  const extension = extname(fileName ?? "").toLowerCase();
  return MARKDOWN_EXTENSIONS.has(extension) ? "markdown" : "txt";
}

function normalizeRequiredTextContent(value: string): string {
  if (typeof value !== "string") {
    throw new BadRequestException("Field 'content' must be a string.");
  }

  if (value.trim().length === 0) {
    throw new BadRequestException("Field 'content' must not be empty.");
  }

  return value;
}

export function resolveImportedFileType(fileName: string, mimeType: string): ImportedFileType {
  const extension = extname(fileName).toLowerCase();
  const normalizedMimeType = mimeType.toLowerCase();

  if (extension === ".txt") {
    return "txt";
  }

  if (MARKDOWN_EXTENSIONS.has(extension)) {
    return "markdown";
  }

  if (extension === ".pdf" || normalizedMimeType === "application/pdf") {
    return "pdf";
  }

  if (WORD_EXTENSIONS.has(extension) || WORD_MIME_TYPES.has(normalizedMimeType)) {
    return "word";
  }

  if (MARKDOWN_MIME_TYPES.has(normalizedMimeType)) {
    return "markdown";
  }

  if (normalizedMimeType === "text/plain") {
    return extension === "" ? "txt" : "txt";
  }

  if (normalizedMimeType === "application/octet-stream") {
    if (extension === ".txt") {
      return "txt";
    }

    if (MARKDOWN_EXTENSIONS.has(extension)) {
      return "markdown";
    }
  }

  throw new UnsupportedMediaTypeException(
    "Unsupported imported file type. Upload .txt, .md, .markdown, .pdf, .docx, or .doc files.",
  );
}
