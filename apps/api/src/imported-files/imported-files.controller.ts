import type { ImportedFile, ListImportedFilesResponse } from "@digital-self/shared";
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
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  ValidationPipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import { CreateImportedFileTextDto } from "./dto/create-imported-file-text.dto";
import { ListImportedFilesQueryDto } from "./dto/list-imported-files-query.dto";
import {
  MAX_IMPORTED_FILE_BYTES,
  type UploadedBinaryFile,
  ImportedFilesService,
} from "./imported-files.service";

const createImportedFileTextValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: CreateImportedFileTextDto,
});

const listImportedFilesValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: ListImportedFilesQueryDto,
});

const uploadedImportedFileValidationPipe = new ParseFilePipeBuilder()
  .addMaxSizeValidator({
    maxSize: MAX_IMPORTED_FILE_BYTES,
  })
  .build({
    fileIsRequired: true,
    errorHttpStatusCode: HttpStatus.BAD_REQUEST,
  });

@Controller("imported-files")
export class ImportedFilesController {
  constructor(
    @Inject(ImportedFilesService)
    private readonly importedFilesService: ImportedFilesService,
  ) {}

  @Post("text")
  createText(
    @Body(createImportedFileTextValidationPipe)
    body: CreateImportedFileTextDto,
  ): Promise<ImportedFile> {
    return this.importedFilesService.createHistoryText(body);
  }

  @Post("file")
  @UseInterceptors(FileInterceptor("file"))
  createFromFile(
    @UploadedFile(uploadedImportedFileValidationPipe) file: UploadedBinaryFile,
  ): Promise<ImportedFile> {
    return this.importedFilesService.createHistoryImportedFile(file);
  }

  @Get()
  list(
    @Query(listImportedFilesValidationPipe)
    query: ListImportedFilesQueryDto,
  ): Promise<ListImportedFilesResponse> {
    return this.importedFilesService.list(query);
  }

  @Get(":id")
  findById(@Param("id", new ParseUUIDPipe()) id: string): Promise<ImportedFile> {
    return this.importedFilesService.findById(id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    await this.importedFilesService.delete(id);
  }
}
