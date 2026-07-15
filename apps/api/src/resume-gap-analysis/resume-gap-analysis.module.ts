import { Module } from "@nestjs/common";

import { IdentityModule } from "../identity/identity.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ResumeGapAnalysisController } from "./resume-gap-analysis.controller";
import { ResumeGapAnalysisRepository } from "./resume-gap-analysis.repository";
import { ResumeGapAnalysisService } from "./resume-gap-analysis.service";

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [ResumeGapAnalysisController],
  providers: [ResumeGapAnalysisRepository, ResumeGapAnalysisService],
})
export class ResumeGapAnalysisModule {}
