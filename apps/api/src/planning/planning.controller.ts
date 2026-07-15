import type { ActionItem, FuturePlan, Goal, Milestone, PlanningTree } from "@digital-self/shared";
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, ValidationPipe } from "@nestjs/common";
import { CreateActionItemDto, CreateFuturePlanDto, CreateGoalDto, CreateMilestoneDto, UpdateActionItemDto, UpdateFuturePlanDto, UpdateGoalDto, UpdateMilestoneDto } from "./dto/planning.dto";
import { PlanningService } from "./planning.service";

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });

@Controller("planning")
export class PlanningController {
  constructor(@Inject(PlanningService) private readonly service: PlanningService) {}
  @Get("tree") tree(): Promise<PlanningTree> { return this.service.tree(); }
  @Post("goals") createGoal(@Body(pipe) body: CreateGoalDto): Promise<Goal> { return this.service.createGoal(body); }
  @Patch("goals/:id") updateGoal(@Param("id", new ParseUUIDPipe()) id: string, @Body(pipe) body: UpdateGoalDto): Promise<Goal> { return this.service.updateGoal(id, body); }
  @Delete("goals/:id") @HttpCode(204) deleteGoal(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> { return this.service.deleteGoal(id); }
  @Post("goals/:id/plans") createPlan(@Param("id", new ParseUUIDPipe()) id: string, @Body(pipe) body: CreateFuturePlanDto): Promise<FuturePlan> { return this.service.createPlan(id, body); }
  @Patch("plans/:id") updatePlan(@Param("id", new ParseUUIDPipe()) id: string, @Body(pipe) body: UpdateFuturePlanDto): Promise<FuturePlan> { return this.service.updatePlan(id, body); }
  @Delete("plans/:id") @HttpCode(204) deletePlan(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> { return this.service.deletePlan(id); }
  @Post("plans/:id/milestones") createMilestone(@Param("id", new ParseUUIDPipe()) id: string, @Body(pipe) body: CreateMilestoneDto): Promise<Milestone> { return this.service.createMilestone(id, body); }
  @Patch("milestones/:id") updateMilestone(@Param("id", new ParseUUIDPipe()) id: string, @Body(pipe) body: UpdateMilestoneDto): Promise<Milestone> { return this.service.updateMilestone(id, body); }
  @Delete("milestones/:id") @HttpCode(204) deleteMilestone(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> { return this.service.deleteMilestone(id); }
  @Post("plans/:id/actions") createAction(@Param("id", new ParseUUIDPipe()) id: string, @Body(pipe) body: CreateActionItemDto): Promise<ActionItem> { return this.service.createAction(id, body); }
  @Patch("actions/:id") updateAction(@Param("id", new ParseUUIDPipe()) id: string, @Body(pipe) body: UpdateActionItemDto): Promise<ActionItem> { return this.service.updateAction(id, body); }
  @Delete("actions/:id") @HttpCode(204) deleteAction(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> { return this.service.deleteAction(id); }
}
