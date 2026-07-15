import type { ArchiveRestoreRequest } from "@digital-self/shared";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class RestoreArchiveDto implements ArchiveRestoreRequest {
  @IsIn(["replace_all", "merge_skip"])
  mode!: "replace_all" | "merge_skip";

  @IsOptional() @IsString() @MaxLength(100)
  confirmationText?: string;
}
