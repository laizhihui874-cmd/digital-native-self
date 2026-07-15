import type { ListImportedFilesQuery } from "@digital-self/shared";
import { importedFileSourceTypeValues } from "@digital-self/shared";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export class ListImportedFilesQueryDto implements ListImportedFilesQuery {
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
  @IsIn(importedFileSourceTypeValues)
  sourceType?: ListImportedFilesQuery["sourceType"];
}
