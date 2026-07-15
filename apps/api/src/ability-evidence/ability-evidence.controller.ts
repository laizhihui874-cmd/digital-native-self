import type {
  AbilityEvidence,
  ListAbilityEvidenceResponse,
} from "@digital-self/shared";
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

import { AbilityEvidenceService } from "./ability-evidence.service";
import { CreateAbilityEvidenceDto } from "./dto/create-ability-evidence.dto";
import { ListAbilityEvidenceQueryDto } from "./dto/list-ability-evidence-query.dto";
import { ReviewAbilityEvidenceDto } from "./dto/review-ability-evidence.dto";

const createAbilityEvidenceValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: CreateAbilityEvidenceDto,
});

const listAbilityEvidenceValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: ListAbilityEvidenceQueryDto,
});

const reviewAbilityEvidenceValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: ReviewAbilityEvidenceDto,
});

@Controller("ability-evidence")
export class AbilityEvidenceController {
  constructor(
    @Inject(AbilityEvidenceService)
    private readonly abilityEvidenceService: AbilityEvidenceService,
  ) {}

  @Post()
  create(@Body(createAbilityEvidenceValidationPipe) body: CreateAbilityEvidenceDto): Promise<AbilityEvidence> {
    return this.abilityEvidenceService.create(body);
  }

  @Get()
  list(
    @Query(listAbilityEvidenceValidationPipe) query: ListAbilityEvidenceQueryDto,
  ): Promise<ListAbilityEvidenceResponse> {
    return this.abilityEvidenceService.list(query);
  }

  @Get(":id")
  findById(@Param("id", new ParseUUIDPipe()) id: string): Promise<AbilityEvidence> {
    return this.abilityEvidenceService.findById(id);
  }

  @Patch(":id/review")
  review(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(reviewAbilityEvidenceValidationPipe) body: ReviewAbilityEvidenceDto,
  ): Promise<AbilityEvidence> {
    return this.abilityEvidenceService.review(id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    await this.abilityEvidenceService.delete(id);
  }
}
