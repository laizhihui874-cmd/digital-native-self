import type { ListEventCandidatesQuery } from "@digital-self/shared";
import { candidateRecordStatusValues } from "@digital-self/shared";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export class ListEventCandidatesQueryDto implements ListEventCandidatesQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
  @IsOptional() @IsIn(candidateRecordStatusValues) status?: ListEventCandidatesQuery["status"];
}
