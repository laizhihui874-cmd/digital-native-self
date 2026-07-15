import type { ArchiveExport, ArchiveRestorePreview, ArchiveRestoreResult, DataControlOverview, DeleteAiDataResponse } from "@digital-self/shared";
import { Body, Controller, Delete, Get, HttpStatus, Inject, ParseFilePipeBuilder, Post, Res, UploadedFile, UseInterceptors, ValidationPipe } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";

import type { UploadedBinaryFile } from "../imported-files/imported-files.service";
import { DataControlService } from "./data-control.service";
import { DeleteAiDataDto } from "./dto/delete-ai-data.dto";
import { RestoreArchiveDto } from "./dto/restore-archive.dto";

const MAX_ARCHIVE_BUNDLE_BYTES = 50 * 1024 * 1024;
const uploadedArchivePipe = new ParseFilePipeBuilder()
  .addMaxSizeValidator({ maxSize: MAX_ARCHIVE_BUNDLE_BYTES })
  .build({ fileIsRequired: true, errorHttpStatusCode: HttpStatus.BAD_REQUEST });
const deleteAiDataPipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, expectedType: DeleteAiDataDto });

@Controller("data-control")
export class DataControlController {
  constructor(@Inject(DataControlService) private readonly service: DataControlService) {}

  @Get()
  overview(): Promise<DataControlOverview> {
    return this.service.overview();
  }

  @Get("archive-export")
  exportArchive(): Promise<ArchiveExport> {
    return this.service.exportArchive();
  }

  @Get("archive-export.zip")
  async exportArchiveBundle(@Res() response: Response): Promise<void> {
    const bundle = await this.service.exportArchiveBundle();
    response.setHeader("content-type", "application/zip");
    response.setHeader("content-disposition", `attachment; filename="digital-self-archive-${new Date().toISOString().slice(0, 10)}.zip"`);
    response.send(bundle);
  }

  @Post("restore-preview")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_ARCHIVE_BUNDLE_BYTES } }))
  previewRestore(@UploadedFile(uploadedArchivePipe) file: UploadedBinaryFile): Promise<ArchiveRestorePreview> {
    return this.service.previewRestore(file);
  }

  @Post("restore")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_ARCHIVE_BUNDLE_BYTES } }))
  restore(
    @UploadedFile(uploadedArchivePipe) file: UploadedBinaryFile,
    @Body(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, expectedType: RestoreArchiveDto })) body: RestoreArchiveDto,
  ): Promise<ArchiveRestoreResult> {
    return this.service.restore(file, body);
  }

  @Delete("ai-data")
  deleteAiData(@Body(deleteAiDataPipe) body: DeleteAiDataDto): Promise<DeleteAiDataResponse> {
    return this.service.deleteAiData(body);
  }
}
