import type { ExtractResumeMaterialCandidatesRequest } from "@digital-self/shared";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class ExtractResumeMaterialCandidatesDto implements ExtractResumeMaterialCandidatesRequest {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limitPerSource?: number;
}
