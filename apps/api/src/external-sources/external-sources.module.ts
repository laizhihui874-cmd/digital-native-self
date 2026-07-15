import { Module } from "@nestjs/common";

import { LifeDecisionsRepository } from "../life-decisions/life-decisions.repository";
import { ExternalSourceSearchProvider } from "./external-source-search.provider";
import { ExternalSourcesController } from "./external-sources.controller";
import { ExternalSourcesRepository } from "./external-sources.repository";
import { ExternalSourcesService } from "./external-sources.service";

@Module({
  controllers: [ExternalSourcesController],
  providers: [
    ExternalSourceSearchProvider,
    ExternalSourcesRepository,
    ExternalSourcesService,
    LifeDecisionsRepository,
  ],
})
export class ExternalSourcesModule {}
