import { Module } from "@nestjs/common";

import { IdentityModule } from "../identity/identity.module";
import { ImportedFilesController } from "./imported-files.controller";
import { ImportedFilesRepository } from "./imported-files.repository";
import { ImportedFilesService } from "./imported-files.service";

@Module({
  imports: [IdentityModule],
  controllers: [ImportedFilesController],
  providers: [ImportedFilesRepository, ImportedFilesService],
  exports: [ImportedFilesRepository, ImportedFilesService],
})
export class ImportedFilesModule {}
