import { Module } from "@nestjs/common";

import { IdentityModule } from "../identity/identity.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ProjectsController } from "./projects.controller";
import { ProjectsRepository } from "./projects.repository";
import { ProjectsService } from "./projects.service";

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [ProjectsController],
  providers: [ProjectsRepository, ProjectsService],
})
export class ProjectsModule {}
