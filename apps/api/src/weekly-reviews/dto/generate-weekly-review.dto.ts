import type { WeeklyReviewGenerateRequest } from "@digital-self/shared";
import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class GenerateWeeklyReviewDto implements WeeklyReviewGenerateRequest {
  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsUUID("4")
  lifeDecisionId?: string;
}
