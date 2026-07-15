import type { UpdateProjectRequest } from "@digital-self/shared";
import { projectStatusValues } from "@digital-self/shared";
import { Transform } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class UpdateProjectDto implements UpdateProjectRequest {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  name?: string;

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
  status?: UpdateProjectRequest["status"];

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
