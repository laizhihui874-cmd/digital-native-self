import type { LifeDecision } from "@digital-self/shared";
import { lifeDecisionStatusValues } from "@digital-self/shared";
import { Transform } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from "class-validator";

function trimOptionalString(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim();
}

function normalizeNullableString(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNullableDateString(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class UpdateLifeDecisionDto {
  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  description?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizeNullableDateString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString()
  deadline?: string | null;

  @IsOptional()
  @IsIn(lifeDecisionStatusValues)
  status?: LifeDecision["status"];

  @IsOptional()
  @Transform(({ value }) => normalizeNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  finalDecision?: string | null;
}
