import type {
  AbilityNodeDetail,
  ListAbilityNodesResponse,
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
  ValidationPipe,
} from "@nestjs/common";

import { AbilityNodesService } from "./ability-nodes.service";
import { CreateAbilityNodeDto } from "./dto/create-ability-node.dto";
import { UpdateAbilityNodeDto } from "./dto/update-ability-node.dto";

const createAbilityNodeValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: CreateAbilityNodeDto,
});

const updateAbilityNodeValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  expectedType: UpdateAbilityNodeDto,
});

@Controller("ability-nodes")
export class AbilityNodesController {
  constructor(@Inject(AbilityNodesService) private readonly abilityNodesService: AbilityNodesService) {}

  @Post()
  create(@Body(createAbilityNodeValidationPipe) body: CreateAbilityNodeDto): Promise<AbilityNodeDetail> {
    return this.abilityNodesService.create(body);
  }

  @Get()
  list(): Promise<ListAbilityNodesResponse> {
    return this.abilityNodesService.list();
  }

  @Get(":id")
  findById(@Param("id", new ParseUUIDPipe()) id: string): Promise<AbilityNodeDetail> {
    return this.abilityNodesService.findById(id);
  }

  @Patch(":id")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(updateAbilityNodeValidationPipe) body: UpdateAbilityNodeDto,
  ): Promise<AbilityNodeDetail> {
    return this.abilityNodesService.update(id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    await this.abilityNodesService.delete(id);
  }
}
