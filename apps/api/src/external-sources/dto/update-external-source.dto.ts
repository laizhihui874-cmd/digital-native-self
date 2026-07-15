import type { UpdateExternalSourceRequest } from "@digital-self/shared";
import { Transform } from "class-transformer";
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
} from "class-validator";

function trimOptionalString(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeNullableLifeDecisionId(value: unknown): unknown {
  if (value === null) {
    return null;
  }

  return trimOptionalString(value);
}

export class UpdateExternalSourceDto implements UpdateExternalSourceRequest {
  @IsOptional()
  @Transform(({ value }) => normalizeNullableLifeDecisionId(value))
  @IsUUID("4")
  lifeDecisionId?: UpdateExternalSourceRequest["lifeDecisionId"];

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  @IsNotEmpty()
  title?: UpdateExternalSourceRequest["title"];

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  @IsNotEmpty()
  sourceSite?: UpdateExternalSourceRequest["sourceSite"];

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  @IsNotEmpty()
  @IsUrl({
    protocols: ["http", "https"],
    require_protocol: true,
    require_valid_protocol: true,
  })
  url?: UpdateExternalSourceRequest["url"];

  @IsOptional()
  @IsDateString()
  publishedAt?: UpdateExternalSourceRequest["publishedAt"];

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  @IsNotEmpty()
  summary?: UpdateExternalSourceRequest["summary"];

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  @IsNotEmpty()
  relationToDecision?: UpdateExternalSourceRequest["relationToDecision"];
}
