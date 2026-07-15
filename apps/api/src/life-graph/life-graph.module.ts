import { Module } from "@nestjs/common";

import { LifeGraphController } from "./life-graph.controller";
import { LifeGraphRepository } from "./life-graph.repository";
import { LifeGraphService } from "./life-graph.service";

@Module({
  controllers: [LifeGraphController],
  providers: [LifeGraphRepository, LifeGraphService],
})
export class LifeGraphModule {}
