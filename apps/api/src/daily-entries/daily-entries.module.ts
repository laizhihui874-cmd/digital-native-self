import { Module } from "@nestjs/common";

import { StructuredDailyReportsModule } from "../structured-daily-reports/structured-daily-reports.module";
import { DailyEntriesController } from "./daily-entries.controller";
import { DailyEntriesRepository } from "./daily-entries.repository";
import { DailyEntriesService } from "./daily-entries.service";

@Module({
  imports: [StructuredDailyReportsModule],
  controllers: [DailyEntriesController],
  providers: [DailyEntriesRepository, DailyEntriesService],
})
export class DailyEntriesModule {}
