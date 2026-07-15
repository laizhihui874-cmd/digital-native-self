import type { ListReviewItemsQuery } from "@digital-self/shared";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsISO8601, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class ListReviewItemsQueryDto implements ListReviewItemsQuery {
  @IsOptional()
  @IsIn(["proposal", "memory", "ability_evidence"])
  kind?: ListReviewItemsQuery["kind"];

  @IsOptional()
  @IsIn(["candidate", "confirmed", "rejected"])
  status?: ListReviewItemsQuery["status"];

  @IsOptional() @IsString() @MaxLength(200)
  query?: string;

  @IsOptional() @IsString() @MaxLength(80)
  sourceType?: string;

  @IsOptional() @IsISO8601()
  dateFrom?: string;

  @IsOptional() @IsISO8601()
  dateTo?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1)
  minConfidence?: number;

  @IsOptional() @IsIn(["newest", "oldest", "confidence_desc", "confidence_asc"])
  sort?: ListReviewItemsQuery["sort"];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
