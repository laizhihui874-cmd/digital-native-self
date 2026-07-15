import type { CreateMetricRatingRequest } from "@digital-self/shared";
import { metricScoreRange, metricTypeValues } from "@digital-self/shared";
import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class CreateMetricRatingDto implements Omit<CreateMetricRatingRequest, "dailyEntryId"> {
  @IsIn(metricTypeValues)
  metricType!: CreateMetricRatingRequest["metricType"];

  @IsOptional()
  @IsInt()
  @Min(metricScoreRange.min)
  @Max(metricScoreRange.max)
  aiScore?: CreateMetricRatingRequest["aiScore"];

  @IsOptional()
  @IsInt()
  @Min(metricScoreRange.min)
  @Max(metricScoreRange.max)
  userScore?: CreateMetricRatingRequest["userScore"];

  @IsOptional()
  @IsInt()
  @Min(metricScoreRange.min)
  @Max(metricScoreRange.max)
  finalScore?: CreateMetricRatingRequest["finalScore"];

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  aiReason?: CreateMetricRatingRequest["aiReason"];

  @IsOptional()
  @IsBoolean()
  confirmedByUser?: CreateMetricRatingRequest["confirmedByUser"];
}
