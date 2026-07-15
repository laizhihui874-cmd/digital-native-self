import type {
  WeeklyReviewDetail,
  WeeklyReviewGenerateResponse,
} from "@digital-self/shared";
import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  ValidationPipe,
} from "@nestjs/common";

import { GenerateWeeklyReviewDto } from "./dto/generate-weekly-review.dto";
import { GetLatestWeeklyReviewQueryDto } from "./dto/get-latest-weekly-review-query.dto";
import { GetWeeklyReviewByPeriodQueryDto } from "./dto/get-weekly-review-by-period-query.dto";
import { WeeklyReviewsService } from "./weekly-reviews.service";

const generateWeeklyReviewValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: GenerateWeeklyReviewDto,
});

const getLatestWeeklyReviewQueryValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: GetLatestWeeklyReviewQueryDto,
});

const getWeeklyReviewByPeriodQueryValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: GetWeeklyReviewByPeriodQueryDto,
});

@Controller("weekly-reviews")
export class WeeklyReviewsController {
  constructor(
    @Inject(WeeklyReviewsService)
    private readonly weeklyReviewsService: WeeklyReviewsService,
  ) {}

  @Post("generate")
  generate(
    @Body(generateWeeklyReviewValidationPipe) body: GenerateWeeklyReviewDto,
  ): Promise<WeeklyReviewGenerateResponse> {
    return this.weeklyReviewsService.generate(body);
  }

  @Get("latest")
  findLatest(
    @Query(getLatestWeeklyReviewQueryValidationPipe) query: GetLatestWeeklyReviewQueryDto,
  ): Promise<WeeklyReviewDetail | null> {
    return this.weeklyReviewsService.findLatest(query);
  }

  @Get()
  findByPeriod(
    @Query(getWeeklyReviewByPeriodQueryValidationPipe) query: GetWeeklyReviewByPeriodQueryDto,
  ): Promise<WeeklyReviewDetail | null> {
    return this.weeklyReviewsService.findByPeriod(query);
  }
}
