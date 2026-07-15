import { Module } from "@nestjs/common";

import { AbilityEvidenceModule } from "../ability-evidence/ability-evidence.module";
import { EventsModule } from "../events/events.module";
import { IdentityModule } from "../identity/identity.module";
import { MemoriesModule } from "../memories/memories.module";
import { ReviewItemsController } from "./review-items.controller";
import { ReviewItemsService } from "./review-items.service";

@Module({
  imports: [IdentityModule, EventsModule, MemoriesModule, AbilityEvidenceModule],
  controllers: [ReviewItemsController],
  providers: [ReviewItemsService],
})
export class ReviewItemsModule {}
