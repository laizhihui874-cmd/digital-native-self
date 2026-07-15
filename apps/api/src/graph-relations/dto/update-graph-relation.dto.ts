import type { UpdateGraphRelationRequest } from "@digital-self/shared";
import { graphRelationStatusValues } from "@digital-self/shared";
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class UpdateGraphRelationDto implements UpdateGraphRelationRequest {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) relationType?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) label?: string;
  @IsOptional() @IsIn(graphRelationStatusValues) status?: "candidate" | "confirmed" | "rejected";
  @IsOptional() @IsISO8601({ strict: true }) validFrom?: string;
  @IsOptional() @IsISO8601({ strict: true }) validTo?: string;
  @IsOptional() @IsUUID() evidenceFragmentId?: string;
}
