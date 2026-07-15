import type { ListMemoriesQuery } from "@digital-self/shared";
import { memoryStatusValues, memoryTypeValues } from "@digital-self/shared";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export class ListMemoriesQueryDto implements ListMemoriesQuery {
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
  @IsIn(memoryStatusValues)
  status?: ListMemoriesQuery["status"];

  @IsOptional()
  @IsIn(memoryTypeValues)
  memoryType?: ListMemoriesQuery["memoryType"];
}
