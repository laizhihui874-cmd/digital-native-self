import { Module } from "@nestjs/common";

import { IdentityModule } from "../identity/identity.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ProjectPackagingSuggestionsController } from "./project-packaging-suggestions.controller";
import { ProjectPackagingSuggestionsRepository } from "./project-packaging-suggestions.repository";
import { ProjectPackagingSuggestionsService } from "./project-packaging-suggestions.service";

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [ProjectPackagingSuggestionsController],
  providers: [ProjectPackagingSuggestionsRepository, ProjectPackagingSuggestionsService],
})
export class ProjectPackagingSuggestionsModule {}
