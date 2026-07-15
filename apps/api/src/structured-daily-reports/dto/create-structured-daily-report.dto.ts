import type { CreateStructuredDailyReportRequest } from "@digital-self/shared";
import { Type } from "class-transformer";
import { IsArray, IsUUID, ValidateNested } from "class-validator";

import { StructuredTextItemDto } from "./structured-text-item.dto";

export class CreateStructuredDailyReportDto implements CreateStructuredDailyReportRequest {
  @IsUUID("4")
  dailyEntryId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StructuredTextItemDto)
  facts!: StructuredTextItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StructuredTextItemDto)
  emotions!: StructuredTextItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StructuredTextItemDto)
  workItems!: StructuredTextItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StructuredTextItemDto)
  feedback!: StructuredTextItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StructuredTextItemDto)
  growthEvidence!: StructuredTextItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StructuredTextItemDto)
  drainSources!: StructuredTextItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StructuredTextItemDto)
  nextActions!: StructuredTextItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StructuredTextItemDto)
  decisionImpact!: StructuredTextItemDto[];
}
