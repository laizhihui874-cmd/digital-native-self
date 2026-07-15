import type { CreateGraphRelationRequest, LifeGraphNodeType } from "@digital-self/shared";
import { graphRelationStatusValues, lifeGraphNodeTypeValues } from "@digital-self/shared";
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateGraphRelationDto implements CreateGraphRelationRequest {
  @IsIn(lifeGraphNodeTypeValues) sourceType!: LifeGraphNodeType;
  @IsUUID() sourceId!: string;
  @IsIn(lifeGraphNodeTypeValues) targetType!: LifeGraphNodeType;
  @IsUUID() targetId!: string;
  @IsString() @MinLength(1) @MaxLength(80) relationType!: string;
  @IsString() @MinLength(1) @MaxLength(80) label!: string;
  @IsOptional() @IsIn(graphRelationStatusValues.filter((value) => value !== "rejected")) status?: "candidate" | "confirmed";
  @IsOptional() @IsISO8601({ strict: true }) validFrom?: string;
  @IsOptional() @IsISO8601({ strict: true }) validTo?: string;
  @IsOptional() @IsUUID() evidenceFragmentId?: string;
}
