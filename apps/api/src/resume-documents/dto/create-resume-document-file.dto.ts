import type { CreateResumeDocumentFileRequest } from "@digital-self/shared";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString } from "class-validator";

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

function parseOptionalBoolean(value: unknown): unknown {
  if (typeof value === "boolean" || value === undefined) {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return value;
}

export class CreateResumeDocumentFileDto implements CreateResumeDocumentFileRequest {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  title?: string;

  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  @IsBoolean()
  isPrimary?: boolean;
}
