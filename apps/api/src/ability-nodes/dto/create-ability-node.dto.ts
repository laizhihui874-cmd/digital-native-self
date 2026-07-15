import type { CreateAbilityNodeRequest } from "@digital-self/shared";
import { Transform } from "class-transformer";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

function trimRequiredString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

function normalizeOptionalDescription(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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

export class CreateAbilityNodeDto implements CreateAbilityNodeRequest {
  @Transform(({ value }) => trimRequiredString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalDescription(value))
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeNullableUuid(value))
  @IsUUID("4")
  parentId?: string | null;
}
