import type { ListResumeMaterialsQuery } from "@digital-self/shared";
import {
  resumeMaterialSourceTypeValues,
  resumeMaterialStatusValues,
} from "@digital-self/shared";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export class ListResumeMaterialsQueryDto implements ListResumeMaterialsQuery {
  @IsOptional()
  @IsIn(resumeMaterialStatusValues)
  status?: ListResumeMaterialsQuery["status"];

  @IsOptional()
  @IsIn(resumeMaterialSourceTypeValues)
  sourceType?: ListResumeMaterialsQuery["sourceType"];

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
}
