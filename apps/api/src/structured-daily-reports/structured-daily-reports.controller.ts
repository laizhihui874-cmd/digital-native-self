import type {
  CreateStructuredDailyReportMemoryCandidatesResponse,
  StructuredDailyReport,
} from "@digital-self/shared";
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  ValidationPipe,
} from "@nestjs/common";

import { CreateMemoryCandidatesParamsDto } from "./dto/create-memory-candidates-params.dto";
import { CreateStructuredDailyReportDto } from "./dto/create-structured-daily-report.dto";
import { StructuredDailyReportsService } from "./structured-daily-reports.service";

const createStructuredDailyReportValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: CreateStructuredDailyReportDto,
});

const createMemoryCandidatesParamsValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: CreateMemoryCandidatesParamsDto,
});

@Controller("structured-daily-reports")
export class StructuredDailyReportsController {
  constructor(
    @Inject(StructuredDailyReportsService)
    private readonly structuredDailyReportsService: StructuredDailyReportsService,
  ) {}

  @Post()
  create(
    @Body(createStructuredDailyReportValidationPipe) body: CreateStructuredDailyReportDto,
  ): Promise<StructuredDailyReport> {
    return this.structuredDailyReportsService.create(body);
  }

  @Get(":dailyEntryId")
  findByDailyEntryId(
    @Param(createMemoryCandidatesParamsValidationPipe) params: CreateMemoryCandidatesParamsDto,
  ): Promise<StructuredDailyReport> {
    return this.structuredDailyReportsService.findByDailyEntryId(params.dailyEntryId);
  }

  @Post(":dailyEntryId/memory-candidates")
  createMemoryCandidates(
    @Param(createMemoryCandidatesParamsValidationPipe) params: CreateMemoryCandidatesParamsDto,
  ): Promise<CreateStructuredDailyReportMemoryCandidatesResponse> {
    return this.structuredDailyReportsService.createMemoryCandidates(params.dailyEntryId);
  }
}
