import type {
  CreateDailyEntryRequest,
  CreateMetricRatingRequest,
  DailyEntryDetail,
  ListDailyEntriesResponse,
  MetricRatingValue,
} from "@digital-self/shared";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { DefaultIdentityService } from "../identity/default-identity.service";
import { DailyEntriesRepository } from "./daily-entries.repository";

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;
const DEFAULT_DAILY_ENTRY_SOURCE = "web";

@Injectable()
export class DailyEntriesService {
  constructor(
    @Inject(DailyEntriesRepository)
    private readonly dailyEntriesRepository: DailyEntriesRepository,
    @Inject(DefaultIdentityService)
    private readonly identityService: DefaultIdentityService,
  ) {}

  async create(input: CreateDailyEntryRequest): Promise<DailyEntryDetail> {
    const userId = await this.identityService.getCurrentUserId();

    return this.dailyEntriesRepository.create(userId, {
      ...input,
      source: input.source ?? DEFAULT_DAILY_ENTRY_SOURCE,
      recordedAt: input.recordedAt ?? new Date().toISOString(),
    });
  }

  async findById(id: string): Promise<DailyEntryDetail> {
    const userId = await this.identityService.getCurrentUserId();
    const entry = await this.dailyEntriesRepository.findById(userId, id);

    if (!entry) {
      throw new NotFoundException(`DailyEntry ${id} was not found.`);
    }

    return entry;
  }

  async list(query: {
    limit?: number;
    offset?: number;
    from?: string;
    to?: string;
  }): Promise<ListDailyEntriesResponse> {
    if (query.from && query.to && new Date(query.from).getTime() > new Date(query.to).getTime()) {
      throw new BadRequestException("Query parameter 'from' must be earlier than or equal to 'to'.");
    }

    const userId = await this.identityService.getCurrentUserId();

    return this.dailyEntriesRepository.list({
      userId,
      limit: query.limit ?? DEFAULT_LIMIT,
      offset: query.offset ?? DEFAULT_OFFSET,
      from: query.from,
      to: query.to,
    });
  }

  async listMetricRatings(dailyEntryId: string): Promise<MetricRatingValue[]> {
    const userId = await this.identityService.getCurrentUserId();
    const metricRatings = await this.dailyEntriesRepository.listMetricRatings(userId, dailyEntryId);

    if (!metricRatings) {
      throw new NotFoundException(`DailyEntry ${dailyEntryId} was not found.`);
    }

    return metricRatings;
  }

  async upsertMetricRating(
    dailyEntryId: string,
    input: Omit<CreateMetricRatingRequest, "dailyEntryId">,
  ): Promise<MetricRatingValue> {
    const userId = await this.identityService.getCurrentUserId();
    const metricRating = await this.dailyEntriesRepository.upsertMetricRating(userId, {
      dailyEntryId,
      ...input,
    });

    if (!metricRating) {
      throw new NotFoundException(`DailyEntry ${dailyEntryId} was not found.`);
    }

    return metricRating;
  }
}
