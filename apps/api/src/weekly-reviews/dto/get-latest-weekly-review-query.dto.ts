import type { GetLatestWeeklyReviewQuery } from "@digital-self/shared";
import { IsOptional, IsUUID } from "class-validator";

export class GetLatestWeeklyReviewQueryDto implements GetLatestWeeklyReviewQuery {
  @IsOptional()
  @IsUUID("4")
  lifeDecisionId?: string;
}
