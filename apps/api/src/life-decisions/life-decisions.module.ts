import { Module } from "@nestjs/common";

import { LifeDecisionsController } from "./life-decisions.controller";
import { LifeDecisionsRepository } from "./life-decisions.repository";
import { LifeDecisionsService } from "./life-decisions.service";

@Module({
  controllers: [LifeDecisionsController],
  providers: [LifeDecisionsRepository, LifeDecisionsService],
})
export class LifeDecisionsModule {}
