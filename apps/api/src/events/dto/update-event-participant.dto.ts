import type { UpdateEventParticipantRequest } from "@digital-self/shared";
import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class UpdateEventParticipantDto implements UpdateEventParticipantRequest {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsUUID()
  evidenceFragmentId?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  validFrom?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  validTo?: string;
}
