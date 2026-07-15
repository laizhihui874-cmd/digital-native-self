import type { UpdateDecisionEvidenceRequest } from "@digital-self/shared";
import { decisionEvidenceTypeValues } from "@digital-self/shared";
import { Transform } from "class-transformer";
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from "class-validator";

function trimOptionalString(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class UpdateDecisionEvidenceDto implements UpdateDecisionEvidenceRequest {
  @IsOptional()
  @IsIn(decisionEvidenceTypeValues)
  evidenceType?: UpdateDecisionEvidenceRequest["evidenceType"];

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  @IsNotEmpty()
  content?: UpdateDecisionEvidenceRequest["content"];

  @IsOptional()
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsNumber()
  @Min(0)
  @Max(1)
  weight?: UpdateDecisionEvidenceRequest["weight"];
}
