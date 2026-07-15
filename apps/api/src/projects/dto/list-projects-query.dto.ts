import type { ListProjectsQuery } from "@digital-self/shared";
import { projectStatusValues } from "@digital-self/shared";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Min } from "class-validator";

export class ListProjectsQueryDto implements ListProjectsQuery {
  @IsOptional()
  @IsIn(projectStatusValues)
  status?: ListProjectsQuery["status"];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
