import type { TestAiSettingsRequest } from "@digital-self/shared";
import { IsIn, IsOptional } from "class-validator";

export class TestAiSettingsDto implements TestAiSettingsRequest {
  @IsOptional()
  @IsIn(["fast", "analysis"])
  slot?: "fast" | "analysis";
}
