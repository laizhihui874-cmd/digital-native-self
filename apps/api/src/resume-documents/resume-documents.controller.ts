import type {
  ListResumeDocumentsResponse,
  ResumeDocument,
} from "@digital-self/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseFilePipeBuilder,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  ValidationPipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import {
  MAX_IMPORTED_RESUME_FILE_BYTES,
  type UploadedBinaryFile,
} from "../imported-files/imported-files.service";
import { CreateResumeDocumentFileDto } from "./dto/create-resume-document-file.dto";
import { CreateResumeDocumentTextDto } from "./dto/create-resume-document-text.dto";
import { ListResumeDocumentsQueryDto } from "./dto/list-resume-documents-query.dto";
import { UpdateResumeDocumentDto } from "./dto/update-resume-document.dto";
import { ResumeDocumentsService } from "./resume-documents.service";

const createResumeDocumentTextValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: CreateResumeDocumentTextDto,
});

const createResumeDocumentFileValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: CreateResumeDocumentFileDto,
});

const listResumeDocumentsValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: ListResumeDocumentsQueryDto,
});

const updateResumeDocumentValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: UpdateResumeDocumentDto,
});

const uploadedResumeFileValidationPipe = new ParseFilePipeBuilder()
  .addMaxSizeValidator({
    maxSize: MAX_IMPORTED_RESUME_FILE_BYTES,
  })
  .build({
    fileIsRequired: true,
    errorHttpStatusCode: HttpStatus.BAD_REQUEST,
  });

@Controller("resume-documents")
export class ResumeDocumentsController {
  constructor(
    @Inject(ResumeDocumentsService)
    private readonly resumeDocumentsService: ResumeDocumentsService,
  ) {}

  @Post("text")
  createText(
    @Body(createResumeDocumentTextValidationPipe)
    body: CreateResumeDocumentTextDto,
  ): Promise<ResumeDocument> {
    return this.resumeDocumentsService.createText(body);
  }

  @Post("file")
  @UseInterceptors(FileInterceptor("file"))
  createFromFile(
    @UploadedFile(uploadedResumeFileValidationPipe) file: UploadedBinaryFile,
    @Body(createResumeDocumentFileValidationPipe) body: CreateResumeDocumentFileDto,
  ): Promise<ResumeDocument> {
    return this.resumeDocumentsService.createFromFile(file, body);
  }

  @Get()
  list(
    @Query(listResumeDocumentsValidationPipe)
    query: ListResumeDocumentsQueryDto,
  ): Promise<ListResumeDocumentsResponse> {
    return this.resumeDocumentsService.list(query);
  }

  @Get(":id")
  findById(@Param("id", new ParseUUIDPipe()) id: string): Promise<ResumeDocument> {
    return this.resumeDocumentsService.findById(id);
  }

  @Patch(":id")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(updateResumeDocumentValidationPipe) body: UpdateResumeDocumentDto,
  ): Promise<ResumeDocument> {
    return this.resumeDocumentsService.update(id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    await this.resumeDocumentsService.delete(id);
  }
}
