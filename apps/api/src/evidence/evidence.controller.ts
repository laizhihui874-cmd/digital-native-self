import type { EvidenceArtifactDetail, ListEvidenceArtifactsResponse } from "@digital-self/shared";
import { Body, Controller, Get, HttpStatus, Inject, Param, ParseFilePipeBuilder, ParseUUIDPipe, Post, Query, UploadedFile, UseInterceptors, ValidationPipe } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import { CreateTextEvidenceDto } from "./dto/create-text-evidence.dto";
import { AppendParsedRevisionDto } from "./dto/append-parsed-revision.dto";
import { ListEvidenceQueryDto } from "./dto/list-evidence-query.dto";
import { EvidenceService } from "./evidence.service";
import { MAX_IMPORTED_FILE_BYTES, type UploadedBinaryFile } from "../imported-files/imported-files.service";

const validationPipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const uploadedFilePipe = new ParseFilePipeBuilder()
  .addMaxSizeValidator({ maxSize: MAX_IMPORTED_FILE_BYTES })
  .build({ fileIsRequired: true, errorHttpStatusCode: HttpStatus.BAD_REQUEST });

@Controller("evidence/artifacts")
export class EvidenceController {
  constructor(@Inject(EvidenceService) private readonly service: EvidenceService) {}

  @Post("text")
  createText(@Body(validationPipe) body: CreateTextEvidenceDto): Promise<EvidenceArtifactDetail> {
    return this.service.createText(body);
  }

  @Post("file")
  @UseInterceptors(FileInterceptor("file"))
  createFile(@UploadedFile(uploadedFilePipe) file: UploadedBinaryFile): Promise<EvidenceArtifactDetail> {
    return this.service.createFile(file);
  }

  @Get()
  list(@Query(validationPipe) query: ListEvidenceQueryDto): Promise<ListEvidenceArtifactsResponse> {
    return this.service.list(query);
  }

  @Get(":id")
  findById(@Param("id", new ParseUUIDPipe()) id: string): Promise<EvidenceArtifactDetail> {
    return this.service.findById(id);
  }

  @Post(":id/revisions/parsed")
  appendParsedRevision(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(validationPipe) body: AppendParsedRevisionDto,
  ): Promise<EvidenceArtifactDetail> {
    return this.service.appendParsedRevision(id, body);
  }
}
