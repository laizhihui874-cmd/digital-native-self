import { Module } from "@nestjs/common";

import { AiCoreModule } from "../ai-core/ai-core.module";
import { ArchiveSearchController } from "./archive-search.controller";
import { ArchiveSearchRepository } from "./archive-search.repository";
import { ArchiveSearchService } from "./archive-search.service";

@Module({
  imports: [AiCoreModule],
  controllers: [ArchiveSearchController],
  providers: [ArchiveSearchRepository, ArchiveSearchService],
  exports: [ArchiveSearchRepository, ArchiveSearchService],
})
export class ArchiveSearchModule {}
