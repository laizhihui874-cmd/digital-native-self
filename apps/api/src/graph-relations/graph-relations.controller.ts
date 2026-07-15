import type { GraphRelation } from "@digital-self/shared";
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, ValidationPipe } from "@nestjs/common";
import { CreateGraphRelationDto } from "./dto/create-graph-relation.dto";
import { UpdateGraphRelationDto } from "./dto/update-graph-relation.dto";
import { GraphRelationsService } from "./graph-relations.service";

const validationPipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });

@Controller("graph-relations")
export class GraphRelationsController {
  constructor(@Inject(GraphRelationsService) private readonly service: GraphRelationsService) {}
  @Get() list(): Promise<GraphRelation[]> { return this.service.list(); }
  @Post() create(@Body(validationPipe) body: CreateGraphRelationDto): Promise<GraphRelation> { return this.service.create(body); }
  @Patch(":id") update(@Param("id", new ParseUUIDPipe()) id: string, @Body(validationPipe) body: UpdateGraphRelationDto): Promise<GraphRelation> { return this.service.update(id, body); }
  @Delete(":id") @HttpCode(204) delete(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> { return this.service.delete(id); }
}
