import type {
  ExternalSourceSearchCategory,
  SearchExternalSourcesRequest,
} from "@digital-self/shared";
import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

export const externalSourceSearchCategoryValues = [
  "ai_role",
  "job_market",
  "industry",
  "postgraduate",
  "other",
] as const satisfies ExternalSourceSearchCategory[];

function trimRequiredString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

function trimOptionalString(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class SearchExternalSourcesDto implements SearchExternalSourcesRequest {
  @Transform(({ value }) => trimRequiredString(value))
  @IsString()
  @IsNotEmpty()
  query!: string;

  @IsOptional()
  @IsIn(externalSourceSearchCategoryValues)
  category?: ExternalSourceSearchCategory;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsUUID("4")
  lifeDecisionId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number;
}
