import type { CreateExternalSourceImpactDraftRequest } from "@digital-self/shared";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class CreateExternalSourceImpactDraftDto
  implements CreateExternalSourceImpactDraftRequest
{
  @IsUUID("4")
  lifeDecisionId!: CreateExternalSourceImpactDraftRequest["lifeDecisionId"];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID("4", { each: true })
  externalSourceIds?: CreateExternalSourceImpactDraftRequest["externalSourceIds"];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  maxItems?: CreateExternalSourceImpactDraftRequest["maxItems"];
}
