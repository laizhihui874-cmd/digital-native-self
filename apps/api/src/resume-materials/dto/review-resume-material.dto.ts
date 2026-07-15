import type { ReviewResumeMaterialRequest } from "@digital-self/shared";
import { resumeMaterialTypeValues } from "@digital-self/shared";
import { Transform } from "class-transformer";
import { IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";

const reviewResumeMaterialStatusValues = ["confirmed", "rejected"] as const;

function trimOptionalString(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function trimOptionalStringToNull(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class ReviewResumeMaterialDto implements ReviewResumeMaterialRequest {
  @IsIn(reviewResumeMaterialStatusValues)
  status!: ReviewResumeMaterialRequest["status"];

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  @IsNotEmpty()
  content?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalStringToNull(value))
  @IsString()
  suggestedBullet?: string | null;

  @IsOptional()
  @IsIn(resumeMaterialTypeValues)
  materialType?: ReviewResumeMaterialRequest["materialType"];
}
