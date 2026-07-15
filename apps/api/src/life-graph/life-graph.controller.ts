import type { LifeGraphSubgraphResponse } from "@digital-self/shared";
import { Controller, Get, Inject, Query, ValidationPipe } from "@nestjs/common";

import { LifeGraphSubgraphQueryDto } from "./dto/life-graph-subgraph-query.dto";
import { LifeGraphService } from "./life-graph.service";

const subgraphValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: LifeGraphSubgraphQueryDto,
});

@Controller("life-graph")
export class LifeGraphController {
  constructor(@Inject(LifeGraphService) private readonly service: LifeGraphService) {}

  @Get("subgraph")
  getSubgraph(
    @Query(subgraphValidationPipe) query: LifeGraphSubgraphQueryDto,
  ): Promise<LifeGraphSubgraphResponse> {
    return this.service.getSubgraph(query);
  }
}
