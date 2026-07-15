import type { DeleteAiDataRequest } from "@digital-self/shared";
import { IsBoolean, IsOptional } from "class-validator";

export class DeleteAiDataDto implements DeleteAiDataRequest {
  @IsOptional() @IsBoolean()
  conversations?: boolean;

  @IsOptional() @IsBoolean()
  callLogs?: boolean;

  @IsOptional() @IsBoolean()
  settings?: boolean;
}
