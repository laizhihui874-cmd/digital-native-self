import type { DecisionPath, LifeDecision } from "@digital-self/shared";
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  ValidationPipe,
} from "@nestjs/common";

import { CreateDecisionPathDto } from "./dto/create-decision-path.dto";
import { CreateLifeDecisionDto } from "./dto/create-life-decision.dto";
import { ListLifeDecisionsQueryDto } from "./dto/list-life-decisions-query.dto";
import { UpdateDecisionPathDto } from "./dto/update-decision-path.dto";
import { UpdateLifeDecisionDto } from "./dto/update-life-decision.dto";
import type { LifeDecisionDetailResponse } from "./life-decision.mapper";
import { LifeDecisionsService } from "./life-decisions.service";

const createLifeDecisionValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: CreateLifeDecisionDto,
});

const listLifeDecisionsValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: ListLifeDecisionsQueryDto,
});

const updateLifeDecisionValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: UpdateLifeDecisionDto,
});

const createDecisionPathValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: CreateDecisionPathDto,
});

const updateDecisionPathValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: UpdateDecisionPathDto,
});

@Controller("life-decisions")
export class LifeDecisionsController {
  constructor(
    @Inject(LifeDecisionsService)
    private readonly lifeDecisionsService: LifeDecisionsService,
  ) {}

  @Post()
  create(@Body(createLifeDecisionValidationPipe) body: CreateLifeDecisionDto): Promise<LifeDecision> {
    return this.lifeDecisionsService.create(body);
  }

  @Get()
  list(@Query(listLifeDecisionsValidationPipe) query: ListLifeDecisionsQueryDto): Promise<LifeDecision[]> {
    return this.lifeDecisionsService.list(query);
  }

  @Get(":id")
  findById(@Param("id", new ParseUUIDPipe()) id: string): Promise<LifeDecisionDetailResponse> {
    return this.lifeDecisionsService.findById(id);
  }

  @Patch(":id")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(updateLifeDecisionValidationPipe) body: UpdateLifeDecisionDto,
  ): Promise<LifeDecision> {
    return this.lifeDecisionsService.updateDecision(id, body);
  }

  @Post(":decisionId/paths")
  createPath(
    @Param("decisionId", new ParseUUIDPipe()) decisionId: string,
    @Body(createDecisionPathValidationPipe) body: CreateDecisionPathDto,
  ): Promise<DecisionPath> {
    return this.lifeDecisionsService.createPath(decisionId, body);
  }

  @Patch(":decisionId/paths/:pathId")
  updatePath(
    @Param("decisionId", new ParseUUIDPipe()) decisionId: string,
    @Param("pathId", new ParseUUIDPipe()) pathId: string,
    @Body(updateDecisionPathValidationPipe) body: UpdateDecisionPathDto,
  ): Promise<DecisionPath> {
    return this.lifeDecisionsService.updatePath(decisionId, pathId, body);
  }
}
