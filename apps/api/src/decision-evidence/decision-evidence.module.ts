import { Module } from "@nestjs/common";

import { DecisionEvidenceController } from "./decision-evidence.controller";
import { DecisionEvidenceRepository } from "./decision-evidence.repository";
import { DecisionEvidenceService } from "./decision-evidence.service";

@Module({
  controllers: [DecisionEvidenceController],
  providers: [DecisionEvidenceRepository, DecisionEvidenceService],
})
export class DecisionEvidenceModule {}
