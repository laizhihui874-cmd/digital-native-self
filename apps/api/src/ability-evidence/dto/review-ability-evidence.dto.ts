import type { ReviewAbilityEvidenceRequest } from "@digital-self/shared";
import {
  abilityEvidenceImpactValues,
  abilityEvidenceScoreRange,
  abilityFeedbackScoreRange,
} from "@digital-self/shared";
import { Transform } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

const reviewAbilityEvidenceStatusValues = ["confirmed", "rejected"] as const;

function trimOptionalString(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class ReviewAbilityEvidenceDto implements ReviewAbilityEvidenceRequest {
  @IsIn(reviewAbilityEvidenceStatusValues)
  status!: ReviewAbilityEvidenceRequest["status"];

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  @IsNotEmpty()
  content?: ReviewAbilityEvidenceRequest["content"];

  @IsOptional()
  @IsIn(abilityEvidenceImpactValues)
  impact?: ReviewAbilityEvidenceRequest["impact"];

  @IsOptional()
  @IsInt()
  @Min(abilityEvidenceScoreRange.min)
  @Max(abilityEvidenceScoreRange.max)
  difficultyScore?: ReviewAbilityEvidenceRequest["difficultyScore"];

  @IsOptional()
  @IsInt()
  @Min(abilityEvidenceScoreRange.min)
  @Max(abilityEvidenceScoreRange.max)
  independenceScore?: ReviewAbilityEvidenceRequest["independenceScore"];

  @IsOptional()
  @IsInt()
  @Min(abilityEvidenceScoreRange.min)
  @Max(abilityEvidenceScoreRange.max)
  impactScore?: ReviewAbilityEvidenceRequest["impactScore"];

  @IsOptional()
  @IsInt()
  @Min(abilityFeedbackScoreRange.min)
  @Max(abilityFeedbackScoreRange.max)
  feedbackScore?: ReviewAbilityEvidenceRequest["feedbackScore"];

  @IsOptional()
  @IsInt()
  @Min(1)
  recurrenceCount?: ReviewAbilityEvidenceRequest["recurrenceCount"];
}
