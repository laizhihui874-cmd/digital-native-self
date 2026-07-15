import { Module } from "@nestjs/common";

import { AiModelGateway } from "./ai-model.gateway";
import { AiSettingsController } from "./ai-settings.controller";
import { AiSettingsService } from "./ai-settings.service";
import { CredentialStoreService } from "./credential-store.service";

@Module({
  controllers: [AiSettingsController],
  providers: [AiModelGateway, AiSettingsService, CredentialStoreService],
  exports: [AiModelGateway, AiSettingsService, CredentialStoreService],
})
export class AiCoreModule {}
