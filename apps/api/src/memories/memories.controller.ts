import type { ListMemoriesResponse, Memory, MemoryArchiveDetail, SearchMemoriesResponse } from "@digital-self/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  ValidationPipe,
} from "@nestjs/common";

import { CreateMemoryDto } from "./dto/create-memory.dto";
import { ListMemoriesQueryDto } from "./dto/list-memories-query.dto";
import { ReviewMemoryDto } from "./dto/review-memory.dto";
import { SearchMemoriesDto } from "./dto/search-memories.dto";
import { MemoriesService } from "./memories.service";

const createMemoryValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: CreateMemoryDto,
});

const listMemoriesValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: ListMemoriesQueryDto,
});

const reviewMemoryValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: ReviewMemoryDto,
});

const searchMemoriesValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: SearchMemoriesDto,
});

@Controller("memories")
export class MemoriesController {
  private readonly memoriesService: MemoriesService;

  constructor(@Inject(MemoriesService) memoriesService: MemoriesService) {
    this.memoriesService = memoriesService;
  }

  @Post()
  create(@Body(createMemoryValidationPipe) body: CreateMemoryDto): Promise<Memory> {
    return this.memoriesService.create(body);
  }

  @Get()
  list(@Query(listMemoriesValidationPipe) query: ListMemoriesQueryDto): Promise<ListMemoriesResponse> {
    return this.memoriesService.list(query);
  }

  @Post("search")
  search(@Body(searchMemoriesValidationPipe) body: SearchMemoriesDto): Promise<SearchMemoriesResponse> {
    return this.memoriesService.search(body);
  }

  @Get(":id")
  findById(@Param("id", new ParseUUIDPipe()) id: string): Promise<Memory> {
    return this.memoriesService.findById(id);
  }

  @Get(":id/archive-detail")
  findArchiveDetail(@Param("id", new ParseUUIDPipe()) id: string): Promise<MemoryArchiveDetail> {
    return this.memoriesService.findArchiveDetail(id);
  }

  @Patch(":id/review")
  review(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(reviewMemoryValidationPipe) body: ReviewMemoryDto,
  ): Promise<Memory> {
    return this.memoriesService.review(id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    await this.memoriesService.delete(id);
  }
}
