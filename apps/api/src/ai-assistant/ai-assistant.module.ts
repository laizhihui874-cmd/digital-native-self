import { Module } from "@nestjs/common";

import { AiCoreModule } from "../ai-core/ai-core.module";
import { ArchiveSearchModule } from "../archive-search/archive-search.module";
import { AiConversationsController } from "./ai-conversations.controller";
import { AiConversationsService } from "./ai-conversations.service";
import { SourceCitationService } from "./source-citation.service";

@Module({
  imports: [AiCoreModule, ArchiveSearchModule],
  controllers: [AiConversationsController],
  providers: [AiConversationsService, SourceCitationService],
})
export class AiAssistantModule {}
