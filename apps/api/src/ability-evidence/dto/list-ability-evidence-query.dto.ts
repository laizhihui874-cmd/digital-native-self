import type { ListAbilityEvidenceQuery } from "@digital-self/shared";
import { candidateRecordStatusValues } from "@digital-self/shared";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class ListAbilityEvidenceQueryDto implements ListAbilityEvidenceQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsUUID("4")
  abilityNodeId?: ListAbilityEvidenceQuery["abilityNodeId"];

  @IsOptional()
  @IsIn(candidateRecordStatusValues)
  status?: ListAbilityEvidenceQuery["status"];
}
