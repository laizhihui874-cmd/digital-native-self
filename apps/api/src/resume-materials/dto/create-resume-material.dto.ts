import type { CreateResumeMaterialRequest } from "@digital-self/shared";
import {
  resumeMaterialSourceTypeValues,
  resumeMaterialStatusValues,
  resumeMaterialTypeValues,
} from "@digital-self/shared";
import { Transform } from "class-transformer";
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

const createResumeMaterialStatusValues = resumeMaterialStatusValues.filter(
  (value) => value !== "rejected",
) as Array<Extract<CreateResumeMaterialRequest["status"], "candidate" | "confirmed">>;

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

function trimOptionalStringToNull(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function emptyStringToUndefined(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class CreateResumeMaterialDto implements CreateResumeMaterialRequest {
  @IsOptional()
  @IsIn(resumeMaterialSourceTypeValues)
  sourceType?: CreateResumeMaterialRequest["sourceType"];

  @IsOptional()
  @Transform(({ value }) => emptyStringToUndefined(value))
  @IsUUID("4")
  sourceId?: string | null;

  @IsOptional()
  @IsIn(resumeMaterialTypeValues)
  materialType?: CreateResumeMaterialRequest["materialType"];

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalStringToNull(value))
  @IsString()
  suggestedBullet?: string | null;

  @IsOptional()
  @IsIn(createResumeMaterialStatusValues)
  status?: CreateResumeMaterialRequest["status"];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number | null;
}
