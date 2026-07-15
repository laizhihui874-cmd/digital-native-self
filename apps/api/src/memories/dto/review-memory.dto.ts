import type { ReviewMemoryRequest } from "@digital-self/shared";
import { memoryTypeValues } from "@digital-self/shared";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

const reviewMemoryStatusValues = ["confirmed", "rejected", "expired"] as const;

function trimOptionalString(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class ReviewMemoryDto implements ReviewMemoryRequest {
  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  @IsNotEmpty()
  content?: string;

  @IsOptional()
  @IsIn(memoryTypeValues)
  memoryType?: ReviewMemoryRequest["memoryType"];

  @IsIn(reviewMemoryStatusValues)
  status!: ReviewMemoryRequest["status"];

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isMomentaryThought?: boolean;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  @IsNotEmpty()
  changeReason?: string;
}
