import type { GetWeeklyReviewByPeriodQuery } from "@digital-self/shared";
import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class GetWeeklyReviewByPeriodQueryDto implements GetWeeklyReviewByPeriodQuery {
  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsUUID("4")
  lifeDecisionId?: string;
}
