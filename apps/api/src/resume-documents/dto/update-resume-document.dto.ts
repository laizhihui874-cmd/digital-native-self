import type { UpdateResumeDocumentRequest } from "@digital-self/shared";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString } from "class-validator";

function normalizeOptionalTitle(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

export class UpdateResumeDocumentDto implements UpdateResumeDocumentRequest {
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalTitle(value))
  @IsString()
  title?: string | null;

  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  @IsBoolean()
  isPrimary?: boolean;
}
