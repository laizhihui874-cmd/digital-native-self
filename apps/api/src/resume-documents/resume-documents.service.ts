import type {
  CreateResumeDocumentFileRequest,
  CreateResumeDocumentTextRequest,
  ListResumeDocumentsResponse,
  ResumeDocument,
  UpdateResumeDocumentRequest,
} from "@digital-self/shared";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { DefaultIdentityService } from "../identity/default-identity.service";
import {
  deriveTitleFromFileName,
  ImportedFilesService,
  type UploadedBinaryFile,
} from "../imported-files/imported-files.service";
import { ResumeDocumentsRepository } from "./resume-documents.repository";

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

@Injectable()
export class ResumeDocumentsService {
  constructor(
    @Inject(ResumeDocumentsRepository)
    private readonly resumeDocumentsRepository: ResumeDocumentsRepository,
    @Inject(DefaultIdentityService)
    private readonly identityService: DefaultIdentityService,
    @Inject(ImportedFilesService)
    private readonly importedFilesService: ImportedFilesService,
  ) {}

  async createText(input: CreateResumeDocumentTextRequest): Promise<ResumeDocument> {
    const userId = await this.identityService.getCurrentUserId();

    return this.resumeDocumentsRepository.createText(userId, {
      title: normalizeOptionalTitle(input.title),
      content: normalizeRequiredContent(input.content),
      isPrimary: input.isPrimary ?? false,
    });
  }

  async createFromFile(
    file: UploadedBinaryFile,
    input: CreateResumeDocumentFileRequest,
  ): Promise<ResumeDocument> {
    const userId = await this.identityService.getCurrentUserId();
    const importedFile = await this.importedFilesService.createResumeImportedFile(userId, file);

    return this.resumeDocumentsRepository.createFromImportedFile(userId, {
      importedFileId: importedFile.id,
      title: normalizeOptionalTitle(input.title) ?? deriveTitleFromFileName(importedFile.fileName),
      content: normalizeRequiredContent(importedFile.parsedText ?? ""),
      isPrimary: input.isPrimary ?? false,
    });
  }

  async list(query: {
    limit?: number;
    offset?: number;
  }): Promise<ListResumeDocumentsResponse> {
    const userId = await this.identityService.getCurrentUserId();

    return this.resumeDocumentsRepository.list({
      userId,
      limit: query.limit ?? DEFAULT_LIMIT,
      offset: query.offset ?? DEFAULT_OFFSET,
    });
  }

  async findById(id: string): Promise<ResumeDocument> {
    const userId = await this.identityService.getCurrentUserId();
    const document = await this.resumeDocumentsRepository.findById(userId, id);

    if (!document) {
      throw new NotFoundException(`ResumeDocument ${id} was not found.`);
    }

    return document;
  }

  async update(id: string, input: UpdateResumeDocumentRequest): Promise<ResumeDocument> {
    const userId = await this.identityService.getCurrentUserId();
    const document = await this.resumeDocumentsRepository.update(userId, id, {
      title: normalizeUpdatableTitle(input.title),
      isPrimary: input.isPrimary,
    });

    if (!document) {
      throw new NotFoundException(`ResumeDocument ${id} was not found.`);
    }

    return document;
  }

  async delete(id: string): Promise<void> {
    const userId = await this.identityService.getCurrentUserId();
    const deleted = await this.resumeDocumentsRepository.delete(userId, id);

    if (!deleted) {
      throw new NotFoundException(`ResumeDocument ${id} was not found.`);
    }
  }
}

function normalizeOptionalTitle(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeUpdatableTitle(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRequiredContent(value: string): string {
  if (typeof value !== "string") {
    throw new BadRequestException("Field 'content' must be a string.");
  }

  if (value.trim().length === 0) {
    throw new BadRequestException("Field 'content' must not be empty.");
  }

  return value;
}
