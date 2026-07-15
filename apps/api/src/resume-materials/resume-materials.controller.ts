import type {
  ExtractResumeMaterialCandidatesResponse,
  ListResumeMaterialsResponse,
  ResumeMaterial,
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
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  ValidationPipe,
} from "@nestjs/common";

import { CreateResumeMaterialDto } from "./dto/create-resume-material.dto";
import { ExtractResumeMaterialCandidatesDto } from "./dto/extract-resume-material-candidates.dto";
import { ListResumeMaterialsQueryDto } from "./dto/list-resume-materials-query.dto";
import { ReviewResumeMaterialDto } from "./dto/review-resume-material.dto";
import { ResumeMaterialsService } from "./resume-materials.service";

const createResumeMaterialValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: CreateResumeMaterialDto,
});

const extractResumeMaterialCandidatesValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: ExtractResumeMaterialCandidatesDto,
});

const listResumeMaterialsValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: ListResumeMaterialsQueryDto,
});

const reviewResumeMaterialValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: ReviewResumeMaterialDto,
});

@Controller("resume-materials")
export class ResumeMaterialsController {
  constructor(
    @Inject(ResumeMaterialsService)
    private readonly resumeMaterialsService: ResumeMaterialsService,
  ) {}

  @Post()
  create(@Body(createResumeMaterialValidationPipe) body: CreateResumeMaterialDto): Promise<ResumeMaterial> {
    return this.resumeMaterialsService.create(body);
  }

  @Post("extract-candidates")
  @HttpCode(HttpStatus.OK)
  extractCandidates(
    @Body(extractResumeMaterialCandidatesValidationPipe)
    body: ExtractResumeMaterialCandidatesDto = {},
  ): Promise<ExtractResumeMaterialCandidatesResponse> {
    return this.resumeMaterialsService.extractCandidates(body);
  }

  @Get()
  list(
    @Query(listResumeMaterialsValidationPipe) query: ListResumeMaterialsQueryDto,
  ): Promise<ListResumeMaterialsResponse> {
    return this.resumeMaterialsService.list(query);
  }

  @Get(":id")
  findById(@Param("id", new ParseUUIDPipe()) id: string): Promise<ResumeMaterial> {
    return this.resumeMaterialsService.findById(id);
  }

  @Patch(":id/review")
  review(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(reviewResumeMaterialValidationPipe) body: ReviewResumeMaterialDto,
  ): Promise<ResumeMaterial> {
    return this.resumeMaterialsService.review(id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    await this.resumeMaterialsService.delete(id);
  }
}
