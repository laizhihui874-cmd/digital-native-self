import type { UpdateAbilityNodeRequest } from "@digital-self/shared";
import { Transform } from "class-transformer";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from "class-validator";

function trimOptionalName(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim();
}

function normalizeNullableDescription(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNullableUuid(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class UpdateAbilityNodeDto implements UpdateAbilityNodeRequest {
  @IsOptional()
  @Transform(({ value }) => trimOptionalName(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeNullableDescription(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  description?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizeNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID("4")
  parentId?: string | null;
}
