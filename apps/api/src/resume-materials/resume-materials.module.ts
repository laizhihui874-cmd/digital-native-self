import { Module } from "@nestjs/common";

import { IdentityModule } from "../identity/identity.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ResumeMaterialsController } from "./resume-materials.controller";
import { ResumeMaterialsRepository } from "./resume-materials.repository";
import { ResumeMaterialsService } from "./resume-materials.service";

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [ResumeMaterialsController],
  providers: [ResumeMaterialsRepository, ResumeMaterialsService],
})
export class ResumeMaterialsModule {}
