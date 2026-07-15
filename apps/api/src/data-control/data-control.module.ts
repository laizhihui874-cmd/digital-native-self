import { Module } from "@nestjs/common";

import { AiCoreModule } from "../ai-core/ai-core.module";
import { IdentityModule } from "../identity/identity.module";
import { DataControlController } from "./data-control.controller";
import { DataControlService } from "./data-control.service";
import { ArchiveRestoreService } from "./archive-restore.service";

@Module({
  imports: [IdentityModule, AiCoreModule],
  controllers: [DataControlController],
  providers: [DataControlService, ArchiveRestoreService],
})
export class DataControlModule {}
