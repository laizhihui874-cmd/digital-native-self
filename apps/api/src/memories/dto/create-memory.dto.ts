import type { CreateMemoryRequest } from "@digital-self/shared";
import { memoryTypeValues } from "@digital-self/shared";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

const createMemoryStatusValues = ["candidate", "confirmed"] as const;

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class CreateMemoryDto implements CreateMemoryRequest {
  @IsIn(memoryTypeValues)
  memoryType!: CreateMemoryRequest["memoryType"];

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsUUID("4")
  sourceCitationId?: string;

  @IsOptional()
  @IsIn(createMemoryStatusValues)
  status?: CreateMemoryRequest["status"];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @IsOptional()
  @IsBoolean()
  isMomentaryThought?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}
