import type { DecisionEvidence, ListDecisionEvidenceResponse } from "@digital-self/shared";
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

import { DecisionEvidenceService } from "./decision-evidence.service";
import { CreateDecisionEvidenceDto } from "./dto/create-decision-evidence.dto";
import { ListDecisionEvidenceQueryDto } from "./dto/list-decision-evidence-query.dto";
import { UpdateDecisionEvidenceDto } from "./dto/update-decision-evidence.dto";

const createDecisionEvidenceValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: CreateDecisionEvidenceDto,
});

const listDecisionEvidenceValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: ListDecisionEvidenceQueryDto,
});

const updateDecisionEvidenceValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: UpdateDecisionEvidenceDto,
});

@Controller("decision-evidence")
export class DecisionEvidenceController {
  constructor(
    @Inject(DecisionEvidenceService)
    private readonly decisionEvidenceService: DecisionEvidenceService,
  ) {}

  @Post()
  create(
    @Body(createDecisionEvidenceValidationPipe) body: CreateDecisionEvidenceDto,
  ): Promise<DecisionEvidence> {
    return this.decisionEvidenceService.create(body);
  }

  @Get()
  list(
    @Query(listDecisionEvidenceValidationPipe) query: ListDecisionEvidenceQueryDto,
  ): Promise<DecisionEvidence[] | ListDecisionEvidenceResponse> {
    return this.decisionEvidenceService.list(query);
  }

  @Get(":id")
  findById(@Param("id", new ParseUUIDPipe()) id: string): Promise<DecisionEvidence> {
    return this.decisionEvidenceService.findById(id);
  }

  @Patch(":id")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(updateDecisionEvidenceValidationPipe) body: UpdateDecisionEvidenceDto,
  ): Promise<DecisionEvidence> {
    return this.decisionEvidenceService.update(id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    await this.decisionEvidenceService.delete(id);
  }
}
