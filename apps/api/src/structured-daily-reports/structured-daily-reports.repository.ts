import type {
  CreateMetricRatingRequest,
  CreateStructuredDailyReportRequest,
  StructuredDailyReport,
} from "@digital-self/shared";
import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { mapStructuredDailyReport } from "./structured-daily-report.mapper";

@Injectable()
export class StructuredDailyReportsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findOwnedDailyEntryById(
    userId: string,
    dailyEntryId: string,
  ): Promise<{ id: string; rawContent: string; recordedAt: Date | null; createdAt: Date } | null> {
    return this.prisma.dailyEntry.findFirst({
      where: {
        id: dailyEntryId,
        userId,
      },
      select: {
        id: true,
        rawContent: true,
        recordedAt: true,
        createdAt: true,
      },
    });
  }

  async findByDailyEntryId(userId: string, dailyEntryId: string): Promise<StructuredDailyReport | null> {
    const report = await this.prisma.structuredDailyReport.findFirst({
      where: {
        dailyEntryId,
        dailyEntry: {
          is: {
            userId,
          },
        },
      },
    });

    return report ? mapStructuredDailyReport(report) : null;
  }

  async create(input: CreateStructuredDailyReportRequest): Promise<StructuredDailyReport> {
    const report = await this.prisma.structuredDailyReport.create({
      data: {
        dailyEntryId: input.dailyEntryId,
        facts: input.facts,
        emotions: input.emotions,
        workItems: input.workItems,
        feedback: input.feedback,
        growthEvidence: input.growthEvidence,
        drainSources: input.drainSources,
        nextActions: input.nextActions,
        decisionImpact: input.decisionImpact,
      },
    });

    return mapStructuredDailyReport(report);
  }

  async createWithMetricRatings(
    input: CreateStructuredDailyReportRequest,
    metricRatings: Array<
      Pick<CreateMetricRatingRequest, "metricType" | "aiScore" | "aiReason" | "confirmedByUser">
    >,
  ): Promise<StructuredDailyReport> {
    const report = await this.prisma.$transaction(async (transaction) => {
      const createdReport = await transaction.structuredDailyReport.create({
        data: {
          dailyEntryId: input.dailyEntryId,
          facts: input.facts,
          emotions: input.emotions,
          workItems: input.workItems,
          feedback: input.feedback,
          growthEvidence: input.growthEvidence,
          drainSources: input.drainSources,
          nextActions: input.nextActions,
          decisionImpact: input.decisionImpact,
        },
      });

      for (const metricRating of metricRatings) {
        await transaction.metricRating.upsert({
          where: {
            dailyEntryId_metricType: {
              dailyEntryId: input.dailyEntryId,
              metricType: metricRating.metricType,
            },
          },
          create: {
            dailyEntryId: input.dailyEntryId,
            metricType: metricRating.metricType,
            aiScore: metricRating.aiScore ?? null,
            userScore: null,
            finalScore: null,
            aiReason: metricRating.aiReason ?? null,
            confirmedByUser: metricRating.confirmedByUser ?? false,
          },
          update: {
            aiScore: metricRating.aiScore ?? undefined,
            aiReason: metricRating.aiReason ?? undefined,
          },
        });
      }

      return createdReport;
    });

    return mapStructuredDailyReport(report);
  }
}
