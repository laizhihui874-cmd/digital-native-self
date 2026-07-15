import type { CreateResumeGapAnalysisRequest } from "@digital-self/shared";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

function trimOptionalString(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class CreateResumeGapAnalysisDto implements CreateResumeGapAnalysisRequest {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  targetRole!: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  targetJobDescription?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  targetCompany?: string;
}
