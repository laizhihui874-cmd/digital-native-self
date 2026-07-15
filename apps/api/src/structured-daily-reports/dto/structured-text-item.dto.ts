import type { StructuredTextItem } from "@digital-self/shared";
import { Transform } from "class-transformer";
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

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

export class StructuredTextItemDto implements StructuredTextItem {
  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  @IsNotEmpty()
  title?: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  detail!: string;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  citationIds?: string[];
}
