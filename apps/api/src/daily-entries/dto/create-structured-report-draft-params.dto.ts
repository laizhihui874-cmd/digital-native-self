import { IsUUID } from "class-validator";

export class CreateStructuredReportDraftParamsDto {
  @IsUUID("4")
  dailyEntryId!: string;
}
