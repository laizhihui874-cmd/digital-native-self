import type { CreateDecisionEvidenceRequest } from "@digital-self/shared";
import { decisionEvidenceTypeValues } from "@digital-self/shared";
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

function trimRequiredString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class CreateDecisionEvidenceDto implements CreateDecisionEvidenceRequest {
  @IsUUID("4")
  decisionId!: CreateDecisionEvidenceRequest["decisionId"];

  @IsUUID("4")
  pathId!: CreateDecisionEvidenceRequest["pathId"];

  @IsIn(decisionEvidenceTypeValues)
  evidenceType!: CreateDecisionEvidenceRequest["evidenceType"];

  @Transform(({ value }) => trimRequiredString(value))
  @IsString()
  @IsNotEmpty()
  content!: CreateDecisionEvidenceRequest["content"];

  @IsOptional()
  @IsUUID("4")
  sourceCitationId?: CreateDecisionEvidenceRequest["sourceCitationId"];

  @IsOptional()
  @IsUUID("4")
  externalSourceId?: CreateDecisionEvidenceRequest["externalSourceId"];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  weight?: CreateDecisionEvidenceRequest["weight"];
}
