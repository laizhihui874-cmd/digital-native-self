import { Module } from "@nestjs/common";

import { AbilityEvidenceModule } from "./ability-evidence/ability-evidence.module";
import { AbilityNodesModule } from "./ability-nodes/ability-nodes.module";
import { AiAssistantModule } from "./ai-assistant/ai-assistant.module";
import { DailyEntriesModule } from "./daily-entries/daily-entries.module";
import { ArchiveSearchModule } from "./archive-search/archive-search.module";
import { DataControlModule } from "./data-control/data-control.module";
import { DecisionEvidenceModule } from "./decision-evidence/decision-evidence.module";
import { ExternalSourcesModule } from "./external-sources/external-sources.module";
import { EvidenceModule } from "./evidence/evidence.module";
import { EventsModule } from "./events/events.module";
import { GraphRelationsModule } from "./graph-relations/graph-relations.module";
import { IdentityModule } from "./identity/identity.module";
import { ImportedFilesModule } from "./imported-files/imported-files.module";
import { LifeDecisionsModule } from "./life-decisions/life-decisions.module";
import { LifeGraphModule } from "./life-graph/life-graph.module";
import { MemoriesModule } from "./memories/memories.module";
import { PeopleModule } from "./people/people.module";
import { PlanningModule } from "./planning/planning.module";
import { ReviewItemsModule } from "./review-items/review-items.module";
import { ProjectPackagingSuggestionsModule } from "./project-packaging-suggestions/project-packaging-suggestions.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProjectsModule } from "./projects/projects.module";
import { HealthController } from "./rest/health.controller";
import { ResourcesController } from "./rest/resources.controller";
import { ResumeDocumentsModule } from "./resume-documents/resume-documents.module";
import { ResumeGapAnalysisModule } from "./resume-gap-analysis/resume-gap-analysis.module";
import { ResumeMaterialsModule } from "./resume-materials/resume-materials.module";
import { StructuredDailyReportsModule } from "./structured-daily-reports/structured-daily-reports.module";
import { WeeklyReviewsModule } from "./weekly-reviews/weekly-reviews.module";

@Module({
  imports: [
    PrismaModule,
    IdentityModule,
    ArchiveSearchModule,
    AiAssistantModule,
    AbilityEvidenceModule,
    AbilityNodesModule,
    DailyEntriesModule,
    DataControlModule,
    DecisionEvidenceModule,
    ExternalSourcesModule,
    EvidenceModule,
    EventsModule,
    GraphRelationsModule,
    ImportedFilesModule,
    StructuredDailyReportsModule,
    MemoriesModule,
    PeopleModule,
    PlanningModule,
    ReviewItemsModule,
    LifeDecisionsModule,
    LifeGraphModule,
    ProjectPackagingSuggestionsModule,
    ProjectsModule,
    ResumeDocumentsModule,
    ResumeMaterialsModule,
    ResumeGapAnalysisModule,
    WeeklyReviewsModule,
  ],
  controllers: [HealthController, ResourcesController],
})
export class AppModule {}
