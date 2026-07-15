import { Module } from "@nestjs/common";

import { IdentityModule } from "../identity/identity.module";
import { EvidenceController } from "./evidence.controller";
import { EvidenceService } from "./evidence.service";

@Module({ imports: [IdentityModule], controllers: [EvidenceController], providers: [EvidenceService] })
export class EvidenceModule {}
