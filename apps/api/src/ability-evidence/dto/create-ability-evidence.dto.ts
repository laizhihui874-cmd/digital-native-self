import type { CreateAbilityEvidenceRequest } from "@digital-self/shared";
import {
  abilityEvidenceImpactValues,
  abilityEvidenceScoreRange,
  abilityFeedbackScoreRange,
  candidateRecordStatusValues,
} from "@digital-self/shared";
import { Transform } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class CreateAbilityEvidenceDto {
  @IsUUID("4")
  abilityNodeId!: CreateAbilityEvidenceRequest["abilityNodeId"];

  @IsOptional()
  @IsUUID("4")
  sourceCitationId?: CreateAbilityEvidenceRequest["sourceCitationId"];

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  content!: CreateAbilityEvidenceRequest["content"];

  @IsIn(abilityEvidenceImpactValues)
  impact!: CreateAbilityEvidenceRequest["impact"];

  @IsInt()
  @Min(abilityEvidenceScoreRange.min)
  @Max(abilityEvidenceScoreRange.max)
  difficultyScore!: CreateAbilityEvidenceRequest["difficultyScore"];

  @IsInt()
  @Min(abilityEvidenceScoreRange.min)
  @Max(abilityEvidenceScoreRange.max)
  independenceScore!: CreateAbilityEvidenceRequest["independenceScore"];

  @IsInt()
  @Min(abilityEvidenceScoreRange.min)
  @Max(abilityEvidenceScoreRange.max)
  impactScore!: CreateAbilityEvidenceRequest["impactScore"];

  @IsInt()
  @Min(abilityFeedbackScoreRange.min)
  @Max(abilityFeedbackScoreRange.max)
  feedbackScore!: CreateAbilityEvidenceRequest["feedbackScore"];

  @IsOptional()
  @IsInt()
  @Min(1)
  recurrenceCount?: CreateAbilityEvidenceRequest["recurrenceCount"];

  @IsOptional()
  @IsIn(candidateRecordStatusValues)
  status?: CreateAbilityEvidenceRequest["status"];
}
