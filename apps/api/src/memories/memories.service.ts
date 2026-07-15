import type {
  CreateMemoryRequest,
  ListMemoriesResponse,
  Memory,
  MemoryArchiveDetail,
  ReviewMemoryRequest,
  SearchMemoriesRequest,
  SearchMemoriesResponse,
} from "@digital-self/shared";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { DefaultIdentityService } from "../identity/default-identity.service";
import {
  rankMemoriesByDeterministicSimilarity,
} from "./deterministic-memory-rag";
import { MemoriesRepository } from "./memories.repository";

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;
const DEFAULT_MEMORY_STATUS = "candidate";

@Injectable()
export class MemoriesService {
  private readonly memoriesRepository: MemoriesRepository;
  private readonly identityService: DefaultIdentityService;

  constructor(
    @Inject(MemoriesRepository) memoriesRepository: MemoriesRepository,
    @Inject(DefaultIdentityService) identityService: DefaultIdentityService,
  ) {
    this.memoriesRepository = memoriesRepository;
    this.identityService = identityService;
  }

  async create(input: CreateMemoryRequest): Promise<Memory> {
    if (input.expiresAt && Number.isNaN(new Date(input.expiresAt).getTime())) {
      throw new BadRequestException("Field 'expiresAt' must be a valid ISO date string.");
    }

    const userId = await this.identityService.getCurrentUserId();

    return this.memoriesRepository.create(userId, {
      ...input,
      status: input.status ?? DEFAULT_MEMORY_STATUS,
      isMomentaryThought: input.isMomentaryThought ?? false,
    });
  }

  async findById(id: string): Promise<Memory> {
    const userId = await this.identityService.getCurrentUserId();
    const memory = await this.memoriesRepository.findById(userId, id);

    if (!memory) {
      throw new NotFoundException(`Memory ${id} was not found.`);
    }

    return memory;
  }

  async findArchiveDetail(id: string): Promise<MemoryArchiveDetail> {
    const userId = await this.identityService.getCurrentUserId();
    const memory = await this.memoriesRepository.findArchiveDetail(userId, id);
    if (!memory) throw new NotFoundException(`Memory ${id} was not found.`);
    return memory;
  }

  async list(query: {
    status?: CreateMemoryRequest["status"] | ReviewMemoryRequest["status"];
    memoryType?: CreateMemoryRequest["memoryType"];
    limit?: number;
    offset?: number;
  }): Promise<ListMemoriesResponse> {
    const userId = await this.identityService.getCurrentUserId();

    return this.memoriesRepository.list({
      userId,
      status: query.status,
      memoryType: query.memoryType,
      limit: query.limit ?? DEFAULT_LIMIT,
      offset: query.offset ?? DEFAULT_OFFSET,
    });
  }

  async search(input: SearchMemoriesRequest): Promise<SearchMemoriesResponse> {
    const query = input.query.trim();

    if (!query) {
      throw new BadRequestException("Field 'query' must not be empty.");
    }

    const userId = await this.identityService.getCurrentUserId();
    const confirmedMemories = await this.memoriesRepository.listConfirmedForRetrieval(userId);
    const ranked = rankMemoriesByDeterministicSimilarity(query, confirmedMemories)
      .slice(0, input.limit ?? 5);

    return {
      retrievalMode: "lexical",
      embeddingModel: "none",
      query,
      items: ranked.map((item) => ({
        memory: item.memory,
        score: item.score,
        matchedTerms: item.matchedTerms,
      })),
      sourceSnapshot: {
        confirmedMemoriesRead: confirmedMemories.length,
        embeddedMemoriesCreatedOrUpdated: 0,
      },
      warning:
        "当前使用本机关键词检索；embeddingModel 字段仅为旧客户端兼容保留。",
    };
  }

  async review(id: string, input: ReviewMemoryRequest): Promise<Memory> {
    if (input.expiresAt && Number.isNaN(new Date(input.expiresAt).getTime())) {
      throw new BadRequestException("Field 'expiresAt' must be a valid ISO date string.");
    }

    const userId = await this.identityService.getCurrentUserId();
    const memory = await this.memoriesRepository.review(userId, id, input);

    if (!memory) {
      throw new NotFoundException(`Memory ${id} was not found.`);
    }

    return memory;
  }

  async delete(id: string): Promise<void> {
    const userId = await this.identityService.getCurrentUserId();
    const deleted = await this.memoriesRepository.delete(userId, id);

    if (!deleted) {
      throw new NotFoundException(`Memory ${id} was not found.`);
    }
  }
}
