import type { AiSettings, TestAiSettingsResponse } from "@digital-self/shared";
import { Body, Controller, Get, Inject, Post, Put, ValidationPipe } from "@nestjs/common";

import { AiSettingsService } from "./ai-settings.service";
import { TestAiSettingsDto } from "./dto/test-ai-settings.dto";
import { UpdateAiSettingsDto } from "./dto/update-ai-settings.dto";

const settingsPipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, expectedType: UpdateAiSettingsDto });
const testPipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, expectedType: TestAiSettingsDto });

@Controller("ai/settings")
export class AiSettingsController {
  constructor(@Inject(AiSettingsService) private readonly settings: AiSettingsService) {}

  @Get()
  get(): Promise<AiSettings> { return this.settings.get(); }

  @Put()
  update(@Body(settingsPipe) body: UpdateAiSettingsDto): Promise<AiSettings> { return this.settings.update(body); }

  @Post("test")
  test(@Body(testPipe) body: TestAiSettingsDto): Promise<TestAiSettingsResponse> { return this.settings.test(body.slot ?? "fast"); }
}
