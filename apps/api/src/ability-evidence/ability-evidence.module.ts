import { Module } from "@nestjs/common";

import { AbilityNodesRepository } from "../ability-nodes/ability-nodes.repository";
import { AbilityEvidenceController } from "./ability-evidence.controller";
import { AbilityEvidenceRepository } from "./ability-evidence.repository";
import { AbilityEvidenceService } from "./ability-evidence.service";

@Module({
  controllers: [AbilityEvidenceController],
  providers: [AbilityEvidenceRepository, AbilityEvidenceService, AbilityNodesRepository],
  exports: [AbilityEvidenceRepository, AbilityEvidenceService],
})
export class AbilityEvidenceModule {}
