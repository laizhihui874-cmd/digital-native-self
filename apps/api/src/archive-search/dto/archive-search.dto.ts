import type { ArchiveSearchContext, ArchiveSearchRequest } from "@digital-self/shared";
import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from "class-validator";

export class ArchiveSearchContextDto implements ArchiveSearchContext {
  @IsIn(["event", "memory", "project", "ability", "decision", "person", "goal", "plan", "milestone", "action", "artifact"])
  entityType!: ArchiveSearchContext["entityType"];

  @IsUUID()
  entityId!: string;
}

export class ArchiveSearchDto implements ArchiveSearchRequest {
  @IsString() @IsNotEmpty() @MaxLength(1000)
  query!: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12)
  limit?: number;

  @IsOptional() @ValidateNested() @Type(() => ArchiveSearchContextDto)
  context?: ArchiveSearchContextDto;

  @IsOptional() @IsBoolean()
  allowExpansion?: boolean;
}
