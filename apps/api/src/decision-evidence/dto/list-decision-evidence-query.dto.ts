import type { ListDecisionEvidenceQuery } from "@digital-self/shared";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class ListDecisionEvidenceQueryDto implements ListDecisionEvidenceQuery {
  @IsOptional()
  @IsUUID("4")
  decisionId?: ListDecisionEvidenceQuery["decisionId"];

  @IsOptional()
  @IsUUID("4")
  pathId?: ListDecisionEvidenceQuery["pathId"];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: ListDecisionEvidenceQuery["limit"];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: ListDecisionEvidenceQuery["offset"];
}
