import type { DailyEntryDetail, ListDailyEntriesResponse, StructuredDailyReport } from "@digital-self/shared";
import type { MetricRatingValue } from "@digital-self/shared";
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  ValidationPipe,
} from "@nestjs/common";

import { CreateDailyEntryDto } from "./dto/create-daily-entry.dto";
import { CreateMetricRatingDto } from "./dto/create-metric-rating.dto";
import { CreateStructuredReportDraftParamsDto } from "./dto/create-structured-report-draft-params.dto";
import { ListDailyEntriesQueryDto } from "./dto/list-daily-entries-query.dto";
import { DailyEntriesService } from "./daily-entries.service";
import { StructuredDailyReportsService } from "../structured-daily-reports/structured-daily-reports.service";

const createDailyEntryValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: CreateDailyEntryDto,
});

const listDailyEntriesValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: ListDailyEntriesQueryDto,
});

const createStructuredReportDraftParamsValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: CreateStructuredReportDraftParamsDto,
});

const createMetricRatingValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: CreateMetricRatingDto,
});

@Controller("daily-entries")
export class DailyEntriesController {
  private readonly dailyEntriesService: DailyEntriesService;
  private readonly structuredDailyReportsService: StructuredDailyReportsService;

  constructor(
    @Inject(DailyEntriesService) dailyEntriesService: DailyEntriesService,
    @Inject(StructuredDailyReportsService) structuredDailyReportsService: StructuredDailyReportsService,
  ) {
    this.dailyEntriesService = dailyEntriesService;
    this.structuredDailyReportsService = structuredDailyReportsService;
  }

  @Post()
  create(@Body(createDailyEntryValidationPipe) body: CreateDailyEntryDto): Promise<DailyEntryDetail> {
    return this.dailyEntriesService.create(body);
  }

  @Post(":dailyEntryId/structured-report-draft")
  createStructuredReportDraft(
    @Param(createStructuredReportDraftParamsValidationPipe) params: CreateStructuredReportDraftParamsDto,
  ): Promise<StructuredDailyReport> {
    return this.structuredDailyReportsService.createDraftForDailyEntry(params.dailyEntryId);
  }

  @Post(":dailyEntryId/structured-report-generate")
  generateStructuredReport(
    @Param("dailyEntryId", new ParseUUIDPipe()) dailyEntryId: string,
  ): Promise<StructuredDailyReport> {
    return this.structuredDailyReportsService.generateForDailyEntry(dailyEntryId);
  }

  @Post(":dailyEntryId/metric-ratings")
  upsertMetricRating(
    @Param("dailyEntryId", new ParseUUIDPipe()) dailyEntryId: string,
    @Body(createMetricRatingValidationPipe) body: CreateMetricRatingDto,
  ): Promise<MetricRatingValue> {
    return this.dailyEntriesService.upsertMetricRating(dailyEntryId, body);
  }

  @Get(":dailyEntryId/metric-ratings")
  listMetricRatings(
    @Param("dailyEntryId", new ParseUUIDPipe()) dailyEntryId: string,
  ): Promise<MetricRatingValue[]> {
    return this.dailyEntriesService.listMetricRatings(dailyEntryId);
  }

  @Get(":id")
  findById(@Param("id", new ParseUUIDPipe()) id: string): Promise<DailyEntryDetail> {
    return this.dailyEntriesService.findById(id);
  }

  @Get()
  list(@Query(listDailyEntriesValidationPipe) query: ListDailyEntriesQueryDto): Promise<ListDailyEntriesResponse> {
    return this.dailyEntriesService.list(query);
  }
}
