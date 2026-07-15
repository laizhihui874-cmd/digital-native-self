import type {
  CreateDailyEntryRequest,
  CreateMetricRatingRequest,
  DailyEntry,
  DailyEntryDetail,
  ListDailyEntriesResponse,
  MetricRatingValue,
} from "@digital-self/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { mapDailyEntry, mapDailyEntryDetail, mapMetricRating } from "./daily-entry.mapper";

@Injectable()
export class DailyEntriesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(userId: string, input: Required<Pick<CreateDailyEntryRequest, "source" | "rawContent">> & Pick<CreateDailyEntryRequest, "recordedAt">): Promise<DailyEntryDetail> {
    const entry = await this.prisma.dailyEntry.create({
      data: {
        userId,
        source: input.source,
        rawContent: input.rawContent,
        recordedAt: new Date(input.recordedAt ?? new Date().toISOString()),
      },
      include: dailyEntryDetailInclude,
    });

    return mapDailyEntryDetail(entry);
  }

  async findById(userId: string, id: string): Promise<DailyEntryDetail | null> {
    const entry = await this.prisma.dailyEntry.findFirst({
      where: {
        id,
        userId,
      },
      include: dailyEntryDetailInclude,
    });

    return entry ? mapDailyEntryDetail(entry) : null;
  }

  async list(params: {
    userId: string;
    limit: number;
    offset: number;
    from?: string;
    to?: string;
  }): Promise<ListDailyEntriesResponse> {
    const where = buildListWhereInput(params.userId, params.from, params.to);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.dailyEntry.count({ where }),
      this.prisma.dailyEntry.findMany({
        where,
        orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
        skip: params.offset,
        take: params.limit,
      }),
    ]);

    return {
      items: items.map((item): DailyEntry => mapDailyEntry(item)),
      pagination: {
        limit: params.limit,
        offset: params.offset,
        total,
      },
    };
  }

  async listMetricRatings(userId: string, dailyEntryId: string): Promise<MetricRatingValue[] | null> {
    const ownedDailyEntry = await this.prisma.dailyEntry.findFirst({
      where: {
        id: dailyEntryId,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!ownedDailyEntry) {
      return null;
    }

    const metricRatings = await this.prisma.metricRating.findMany({
      where: {
        dailyEntryId,
      },
      orderBy: [{ createdAt: "asc" }],
    });

    return metricRatings.map(mapMetricRating);
  }

  async upsertMetricRating(
    userId: string,
    input: CreateMetricRatingRequest,
  ): Promise<MetricRatingValue | null> {
    const metricRating = await this.prisma.$transaction(async (transaction) => {
      const ownedDailyEntry = await transaction.dailyEntry.findFirst({
        where: {
          id: input.dailyEntryId,
          userId,
        },
        select: {
          id: true,
        },
      });

      if (!ownedDailyEntry) {
        return null;
      }

      return transaction.metricRating.upsert({
        where: {
          dailyEntryId_metricType: {
            dailyEntryId: input.dailyEntryId,
            metricType: input.metricType,
          },
        },
        create: buildMetricRatingCreateData(input),
        update: buildMetricRatingUpdateData(input),
      });
    });

    return metricRating ? mapMetricRating(metricRating) : null;
  }
}

const dailyEntryDetailInclude = {
  structuredReport: true,
  metricRatings: true,
  events: true,
} as const;

function buildListWhereInput(userId: string, from?: string, to?: string): Prisma.DailyEntryWhereInput {
  return {
    userId,
    recordedAt:
      from || to
        ? {
            gte: from ? new Date(from) : undefined,
            lte: to ? new Date(to) : undefined,
          }
        : undefined,
  };
}

function buildMetricRatingCreateData(
  input: CreateMetricRatingRequest,
): Prisma.MetricRatingUncheckedCreateInput {
  return {
    dailyEntryId: input.dailyEntryId,
    metricType: input.metricType,
    aiScore: input.aiScore ?? null,
    userScore: input.userScore ?? null,
    finalScore: input.finalScore ?? null,
    aiReason: input.aiReason ?? null,
    confirmedByUser: input.confirmedByUser ?? false,
  };
}

function buildMetricRatingUpdateData(input: CreateMetricRatingRequest): Prisma.MetricRatingUpdateInput {
  const data: Prisma.MetricRatingUpdateInput = {};

  if (input.aiScore !== undefined && input.aiScore !== null) {
    data.aiScore = input.aiScore;
  }

  if (input.userScore !== undefined && input.userScore !== null) {
    data.userScore = input.userScore;
  }

  if (input.finalScore !== undefined && input.finalScore !== null) {
    data.finalScore = input.finalScore;
  }

  if (input.aiReason !== undefined && input.aiReason !== null) {
    data.aiReason = input.aiReason;
  }

  if (typeof input.confirmedByUser === "boolean") {
    data.confirmedByUser = input.confirmedByUser;
  }

  return data;
}
