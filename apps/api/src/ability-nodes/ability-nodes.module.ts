import { Module } from "@nestjs/common";

import { AbilityNodesController } from "./ability-nodes.controller";
import { AbilityNodesRepository } from "./ability-nodes.repository";
import { AbilityNodesService } from "./ability-nodes.service";

@Module({
  controllers: [AbilityNodesController],
  providers: [AbilityNodesRepository, AbilityNodesService],
})
export class AbilityNodesModule {}
