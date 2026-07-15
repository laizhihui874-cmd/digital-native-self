import { IsUUID } from "class-validator";

export class CreateMemoryCandidatesParamsDto {
  @IsUUID("4")
  dailyEntryId!: string;
}
