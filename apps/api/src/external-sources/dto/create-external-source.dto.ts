import type { CreateExternalSourceRequest } from "@digital-self/shared";
import { Transform } from "class-transformer";
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
} from "class-validator";

function trimRequiredString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

function trimOptionalString(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class CreateExternalSourceDto implements CreateExternalSourceRequest {
  @IsOptional()
  @IsUUID("4")
  lifeDecisionId?: CreateExternalSourceRequest["lifeDecisionId"];

  @Transform(({ value }) => trimRequiredString(value))
  @IsString()
  @IsNotEmpty()
  title!: CreateExternalSourceRequest["title"];

  @Transform(({ value }) => trimRequiredString(value))
  @IsString()
  @IsNotEmpty()
  sourceSite!: CreateExternalSourceRequest["sourceSite"];

  @Transform(({ value }) => trimRequiredString(value))
  @IsString()
  @IsNotEmpty()
  @IsUrl({
    protocols: ["http", "https"],
    require_protocol: true,
    require_valid_protocol: true,
  })
  url!: CreateExternalSourceRequest["url"];

  @IsOptional()
  @IsDateString()
  publishedAt?: CreateExternalSourceRequest["publishedAt"];

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  @IsNotEmpty()
  summary?: CreateExternalSourceRequest["summary"];

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  @IsNotEmpty()
  relationToDecision?: CreateExternalSourceRequest["relationToDecision"];
}
