import type { CreateProjectRequest } from "@digital-self/shared";
import { projectStatusValues } from "@digital-self/shared";
import { Transform } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class CreateProjectDto implements CreateProjectRequest {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  role?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsIn(projectStatusValues)
  status?: CreateProjectRequest["status"];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  outcomes?: string[];

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  resumeSummary?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  abilityEvidenceIds?: string[];
}
