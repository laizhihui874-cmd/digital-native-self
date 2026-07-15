import type { UpdateAiSettingsRequest } from "@digital-self/shared";
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateAiSettingsDto implements UpdateAiSettingsRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  baseUrl!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  fastModel!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  analysisModel!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsBoolean()
  externalProcessingConsent!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  apiKey?: string;

  @IsOptional()
  @IsBoolean()
  removeCredential?: boolean;
}
