import type {
  CreateActionItemRequest,
  CreateFuturePlanRequest,
  CreateGoalRequest,
  CreateMilestoneRequest,
  UpdateActionItemRequest,
  UpdateFuturePlanRequest,
  UpdateGoalRequest,
  UpdateMilestoneRequest,
} from "@digital-self/shared";
import {
  actionItemStatusValues,
  futurePlanStatusValues,
  goalStatusValues,
  milestoneStatusValues,
} from "@digital-self/shared";
import { IsISO8601, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";

class GoalFields {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsString() @MaxLength(120) area?: string;
  @IsOptional() @IsString() @MaxLength(3000) successCriteria?: string;
  @IsOptional() @IsIn(goalStatusValues) status?: CreateGoalRequest["status"];
  @IsOptional() @IsInt() @Min(1) @Max(5) priority?: number;
  @IsOptional() @IsISO8601({ strict: true }) targetDate?: string;
}
export class CreateGoalDto extends GoalFields implements CreateGoalRequest {
  @IsString() @MinLength(1) @MaxLength(200) declare title: string;
}
export class UpdateGoalDto extends GoalFields implements UpdateGoalRequest {}

class PlanFields {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsIn(futurePlanStatusValues) status?: CreateFuturePlanRequest["status"];
  @IsOptional() @IsISO8601({ strict: true }) startDate?: string;
  @IsOptional() @IsISO8601({ strict: true }) endDate?: string;
}
export class CreateFuturePlanDto extends PlanFields implements CreateFuturePlanRequest {
  @IsString() @MinLength(1) @MaxLength(200) declare title: string;
}
export class UpdateFuturePlanDto extends PlanFields implements UpdateFuturePlanRequest {}

class MilestoneFields {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(3000) description?: string;
  @IsOptional() @IsIn(milestoneStatusValues) status?: CreateMilestoneRequest["status"];
  @IsOptional() @IsISO8601({ strict: true }) dueAt?: string;
}
export class CreateMilestoneDto extends MilestoneFields implements CreateMilestoneRequest {
  @IsString() @MinLength(1) @MaxLength(200) declare title: string;
}
export class UpdateMilestoneDto extends MilestoneFields implements UpdateMilestoneRequest {}

class ActionItemFields {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(240) title?: string;
  @IsOptional() @IsString() @MaxLength(3000) description?: string;
  @IsOptional() @IsIn(actionItemStatusValues) status?: CreateActionItemRequest["status"];
  @IsOptional() @IsISO8601({ strict: true }) dueAt?: string;
  @IsOptional() @IsUUID() milestoneId?: string;
}
export class CreateActionItemDto extends ActionItemFields implements CreateActionItemRequest {
  @IsString() @MinLength(1) @MaxLength(240) declare title: string;
}
export class UpdateActionItemDto extends ActionItemFields implements UpdateActionItemRequest {}
