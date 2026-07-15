import type { LifeDecision } from "@digital-self/shared";
import { lifeDecisionStatusValues } from "@digital-self/shared";
import { IsIn, IsOptional } from "class-validator";

export class ListLifeDecisionsQueryDto {
  @IsOptional()
  @IsIn(lifeDecisionStatusValues)
  status?: LifeDecision["status"];
}
