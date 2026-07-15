import { Module } from "@nestjs/common";

import { ImportedFilesModule } from "../imported-files/imported-files.module";
import { ResumeDocumentsController } from "./resume-documents.controller";
import { ResumeDocumentsRepository } from "./resume-documents.repository";
import { ResumeDocumentsService } from "./resume-documents.service";

@Module({
  imports: [ImportedFilesModule],
  controllers: [ResumeDocumentsController],
  providers: [ResumeDocumentsRepository, ResumeDocumentsService],
})
export class ResumeDocumentsModule {}
