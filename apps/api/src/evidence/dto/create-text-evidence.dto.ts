import type { CreateTextEvidenceArtifactRequest } from "@digital-self/shared";
import { evidencePrivacyLevelValues } from "@digital-self/shared";
import { Transform } from "class-transformer";
import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class CreateTextEvidenceDto implements CreateTextEvidenceArtifactRequest {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsDateString()
  capturedAt?: string;

  @IsOptional()
  @IsIn(evidencePrivacyLevelValues)
  privacyLevel?: CreateTextEvidenceArtifactRequest["privacyLevel"];
}
