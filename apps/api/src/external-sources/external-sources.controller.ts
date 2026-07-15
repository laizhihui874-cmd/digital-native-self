import type {
  ExternalSourceImpactDraftResponse,
  ExternalSource,
  ListExternalSourcesResponse,
  SearchExternalSourcesResponse,
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

import { CreateExternalSourceDto } from "./dto/create-external-source.dto";
import { CreateExternalSourceImpactDraftDto } from "./dto/create-external-source-impact-draft.dto";
import { ListExternalSourcesQueryDto } from "./dto/list-external-sources-query.dto";
import { SearchExternalSourcesDto } from "./dto/search-external-sources.dto";
import { UpdateExternalSourceDto } from "./dto/update-external-source.dto";
import { ExternalSourcesService } from "./external-sources.service";

const createExternalSourceValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: CreateExternalSourceDto,
});

const listExternalSourcesValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: ListExternalSourcesQueryDto,
});

const updateExternalSourceValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: UpdateExternalSourceDto,
});

const searchExternalSourcesValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: SearchExternalSourcesDto,
});

const createExternalSourceImpactDraftValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: CreateExternalSourceImpactDraftDto,
});

@Controller("external-sources")
export class ExternalSourcesController {
  constructor(
    @Inject(ExternalSourcesService)
    private readonly externalSourcesService: ExternalSourcesService,
  ) {}

  @Post()
  create(@Body(createExternalSourceValidationPipe) body: CreateExternalSourceDto): Promise<ExternalSource> {
    return this.externalSourcesService.create(body);
  }

  @Post("search")
  search(
    @Body(searchExternalSourcesValidationPipe) body: SearchExternalSourcesDto,
  ): Promise<SearchExternalSourcesResponse> {
    return this.externalSourcesService.search(body);
  }

  @Post("impact-draft")
  createImpactDraft(
    @Body(createExternalSourceImpactDraftValidationPipe)
    body: CreateExternalSourceImpactDraftDto,
  ): Promise<ExternalSourceImpactDraftResponse> {
    return this.externalSourcesService.createImpactDraft(body);
  }

  @Get()
  list(
    @Query(listExternalSourcesValidationPipe) query: ListExternalSourcesQueryDto,
  ): Promise<ListExternalSourcesResponse> {
    return this.externalSourcesService.list(query);
  }

  @Get(":id")
  findById(@Param("id", new ParseUUIDPipe()) id: string): Promise<ExternalSource> {
    return this.externalSourcesService.findById(id);
  }

  @Patch(":id")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(updateExternalSourceValidationPipe) body: UpdateExternalSourceDto,
  ): Promise<ExternalSource> {
    return this.externalSourcesService.update(id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    await this.externalSourcesService.delete(id);
  }
}
