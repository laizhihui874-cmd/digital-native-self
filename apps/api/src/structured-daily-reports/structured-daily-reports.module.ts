import { Module } from "@nestjs/common";

import { MemoriesModule } from "../memories/memories.module";
import { StructuredDailyReportsController } from "./structured-daily-reports.controller";
import { StructuredDailyReportsRepository } from "./structured-daily-reports.repository";
import { StructuredDailyReportsService } from "./structured-daily-reports.service";

@Module({
  imports: [MemoriesModule],
  controllers: [StructuredDailyReportsController],
  providers: [StructuredDailyReportsRepository, StructuredDailyReportsService],
  exports: [StructuredDailyReportsService],
})
export class StructuredDailyReportsModule {}
