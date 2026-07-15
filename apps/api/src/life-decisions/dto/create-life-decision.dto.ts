import type { CreateLifeDecisionRequest } from "@digital-self/shared";
import { lifeDecisionStatusValues } from "@digital-self/shared";
import { Transform } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

function trimRequiredString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

function normalizeOptionalString(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class CreateLifeDecisionDto implements CreateLifeDecisionRequest {
  @Transform(({ value }) => trimRequiredString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsIn(lifeDecisionStatusValues)
  status?: CreateLifeDecisionRequest["status"];

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  finalDecision?: string;
}
