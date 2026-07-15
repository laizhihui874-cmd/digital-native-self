import type { ListExternalSourcesQuery } from "@digital-self/shared";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class ListExternalSourcesQueryDto implements ListExternalSourcesQuery {
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
  lifeDecisionId?: ListExternalSourcesQuery["lifeDecisionId"];
}
