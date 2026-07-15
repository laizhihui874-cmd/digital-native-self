import type {
  ActionItem,
  CreateActionItemRequest,
  CreateFuturePlanRequest,
  CreateGoalRequest,
  CreateMilestoneRequest,
  FuturePlan,
  Goal,
  Milestone,
  PlanningTree,
  UpdateActionItemRequest,
  UpdateFuturePlanRequest,
  UpdateGoalRequest,
  UpdateMilestoneRequest,
} from "@digital-self/shared";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ActionItem as PrismaActionItem, FuturePlan as PrismaFuturePlan, Goal as PrismaGoal, GraphEntityType, Milestone as PrismaMilestone } from "@prisma/client";

import { DefaultIdentityService } from "../identity/default-identity.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PlanningService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DefaultIdentityService) private readonly identity: DefaultIdentityService,
  ) {}

  async tree(): Promise<PlanningTree> {
    const userId = await this.identity.getCurrentUserId();
    const goals = await this.prisma.goal.findMany({
      where: { userId },
      include: {
        plans: {
          include: { milestones: { orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }] }, actionItems: { orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }] } },
          orderBy: [{ endDate: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: [{ priority: "asc" }, { targetDate: "asc" }, { createdAt: "asc" }],
    });
    return goals.map((goal) => ({
      ...mapGoal(goal),
      plans: goal.plans.map((plan) => ({
        ...mapPlan(plan),
        milestones: plan.milestones.map(mapMilestone),
        actionItems: plan.actionItems.map(mapActionItem),
      })),
    }));
  }

  async createGoal(input: CreateGoalRequest): Promise<Goal> {
    const userId = await this.identity.getCurrentUserId();
    return mapGoal(await this.prisma.goal.create({ data: { ...goalData(input), userId, title: input.title.trim() } }));
  }

  async updateGoal(id: string, input: UpdateGoalRequest): Promise<Goal> {
    const userId = await this.identity.getCurrentUserId();
    await this.requireGoal(id, userId);
    return mapGoal(await this.prisma.goal.update({ where: { id }, data: goalData(input) }));
  }

  async deleteGoal(id: string): Promise<void> {
    const userId = await this.identity.getCurrentUserId();
    const goal = await this.prisma.goal.findFirst({ where: { id, userId }, include: { plans: { include: { milestones: true, actionItems: true } } } });
    if (!goal) throw new NotFoundException(`Goal ${id} was not found.`);
    const nodes = [
      { type: "goal" as const, id },
      ...goal.plans.flatMap((plan) => [
        { type: "plan" as const, id: plan.id },
        ...plan.milestones.map((item) => ({ type: "milestone" as const, id: item.id })),
        ...plan.actionItems.map((item) => ({ type: "action" as const, id: item.id })),
      ]),
    ];
    await this.deleteGraphRelations(userId, nodes);
    await this.prisma.goal.delete({ where: { id } });
  }

  async createPlan(goalId: string, input: CreateFuturePlanRequest): Promise<FuturePlan> {
    const userId = await this.identity.getCurrentUserId();
    await this.requireGoal(goalId, userId);
    assertDateRange(input.startDate, input.endDate);
    return mapPlan(await this.prisma.futurePlan.create({ data: { ...planData(input), userId, goalId, title: input.title.trim() } }));
  }

  async updatePlan(id: string, input: UpdateFuturePlanRequest): Promise<FuturePlan> {
    const userId = await this.identity.getCurrentUserId();
    const current = await this.requirePlan(id, userId);
    assertDateRange(input.startDate ?? current.startDate?.toISOString(), input.endDate ?? current.endDate?.toISOString());
    return mapPlan(await this.prisma.futurePlan.update({ where: { id }, data: planData(input) }));
  }

  async deletePlan(id: string): Promise<void> {
    const userId = await this.identity.getCurrentUserId();
    const plan = await this.prisma.futurePlan.findFirst({ where: { id, userId }, include: { milestones: true, actionItems: true } });
    if (!plan) throw new NotFoundException(`FuturePlan ${id} was not found.`);
    await this.deleteGraphRelations(userId, [
      { type: "plan", id },
      ...plan.milestones.map((item) => ({ type: "milestone" as const, id: item.id })),
      ...plan.actionItems.map((item) => ({ type: "action" as const, id: item.id })),
    ]);
    await this.prisma.futurePlan.delete({ where: { id } });
  }

  async createMilestone(planId: string, input: CreateMilestoneRequest): Promise<Milestone> {
    const userId = await this.identity.getCurrentUserId();
    await this.requirePlan(planId, userId);
    return mapMilestone(await this.prisma.milestone.create({ data: { ...milestoneData(input), userId, planId, title: input.title.trim() } }));
  }

  async updateMilestone(id: string, input: UpdateMilestoneRequest): Promise<Milestone> {
    const userId = await this.identity.getCurrentUserId();
    await this.requireMilestone(id, userId);
    return mapMilestone(await this.prisma.milestone.update({ where: { id }, data: milestoneData(input) }));
  }

  async deleteMilestone(id: string): Promise<void> {
    const userId = await this.identity.getCurrentUserId();
    const milestone = await this.prisma.milestone.findFirst({ where: { id, userId }, include: { actionItems: true } });
    if (!milestone) throw new NotFoundException(`Milestone ${id} was not found.`);
    await this.deleteGraphRelations(userId, [{ type: "milestone", id }, ...milestone.actionItems.map((item) => ({ type: "action" as const, id: item.id }))]);
    await this.prisma.milestone.delete({ where: { id } });
  }

  async createAction(planId: string, input: CreateActionItemRequest): Promise<ActionItem> {
    const userId = await this.identity.getCurrentUserId();
    await this.requirePlan(planId, userId);
    if (input.milestoneId) await this.requireMilestoneInPlan(input.milestoneId, planId, userId);
    return mapActionItem(await this.prisma.actionItem.create({ data: { ...actionData(input), userId, planId, title: input.title.trim() } }));
  }

  async updateAction(id: string, input: UpdateActionItemRequest): Promise<ActionItem> {
    const userId = await this.identity.getCurrentUserId();
    const current = await this.requireAction(id, userId);
    if (input.milestoneId) await this.requireMilestoneInPlan(input.milestoneId, current.planId, userId);
    return mapActionItem(await this.prisma.actionItem.update({ where: { id }, data: actionData(input) }));
  }

  async deleteAction(id: string): Promise<void> {
    const userId = await this.identity.getCurrentUserId();
    await this.requireAction(id, userId);
    await this.deleteGraphRelations(userId, [{ type: "action", id }]);
    await this.prisma.actionItem.delete({ where: { id } });
  }

  private async requireGoal(id: string, userId: string) {
    const record = await this.prisma.goal.findFirst({ where: { id, userId } });
    if (!record) throw new NotFoundException(`Goal ${id} was not found.`);
    return record;
  }
  private async requirePlan(id: string, userId: string) {
    const record = await this.prisma.futurePlan.findFirst({ where: { id, userId } });
    if (!record) throw new NotFoundException(`FuturePlan ${id} was not found.`);
    return record;
  }
  private async requireMilestone(id: string, userId: string) {
    const record = await this.prisma.milestone.findFirst({ where: { id, userId } });
    if (!record) throw new NotFoundException(`Milestone ${id} was not found.`);
    return record;
  }
  private async requireMilestoneInPlan(id: string, planId: string, userId: string) {
    const record = await this.prisma.milestone.findFirst({ where: { id, planId, userId } });
    if (!record) throw new NotFoundException(`Milestone ${id} was not found in plan ${planId}.`);
  }
  private async requireAction(id: string, userId: string) {
    const record = await this.prisma.actionItem.findFirst({ where: { id, userId } });
    if (!record) throw new NotFoundException(`ActionItem ${id} was not found.`);
    return record;
  }
  private async deleteGraphRelations(userId: string, nodes: Array<{ type: GraphEntityType; id: string }>) {
    if (!nodes.length) return;
    await this.prisma.graphRelation.deleteMany({ where: { userId, OR: nodes.flatMap((node) => [
      { sourceType: node.type, sourceId: node.id },
      { targetType: node.type, targetId: node.id },
    ]) } });
  }
}

function clean(value?: string): string | null | undefined { return value === undefined ? undefined : value.trim() || null; }
function goalData(input: UpdateGoalRequest) { return { title: input.title?.trim(), description: clean(input.description), area: clean(input.area), successCriteria: clean(input.successCriteria), status: input.status, priority: input.priority, targetDate: input.targetDate ? new Date(input.targetDate) : undefined }; }
function planData(input: UpdateFuturePlanRequest) { return { title: input.title?.trim(), description: clean(input.description), status: input.status, startDate: input.startDate ? new Date(input.startDate) : undefined, endDate: input.endDate ? new Date(input.endDate) : undefined }; }
function milestoneData(input: UpdateMilestoneRequest) { return { title: input.title?.trim(), description: clean(input.description), status: input.status, dueAt: input.dueAt ? new Date(input.dueAt) : undefined, completedAt: input.status === "completed" ? new Date() : input.status ? null : undefined }; }
function actionData(input: UpdateActionItemRequest) { return { title: input.title?.trim(), description: clean(input.description), status: input.status, dueAt: input.dueAt ? new Date(input.dueAt) : undefined, milestoneId: input.milestoneId, completedAt: input.status === "done" ? new Date() : input.status ? null : undefined }; }
function assertDateRange(start?: string, end?: string) { if (start && end && new Date(start) > new Date(end)) throw new BadRequestException("endDate must be on or after startDate."); }
function mapGoal(value: PrismaGoal): Goal { return { id: value.id, title: value.title, description: value.description ?? undefined, area: value.area ?? undefined, successCriteria: value.successCriteria ?? undefined, status: value.status, priority: value.priority, targetDate: value.targetDate?.toISOString(), createdAt: value.createdAt.toISOString(), updatedAt: value.updatedAt.toISOString() }; }
function mapPlan(value: PrismaFuturePlan): FuturePlan { return { id: value.id, goalId: value.goalId, title: value.title, description: value.description ?? undefined, status: value.status, startDate: value.startDate?.toISOString(), endDate: value.endDate?.toISOString(), createdAt: value.createdAt.toISOString(), updatedAt: value.updatedAt.toISOString() }; }
function mapMilestone(value: PrismaMilestone): Milestone { return { id: value.id, planId: value.planId, title: value.title, description: value.description ?? undefined, status: value.status, dueAt: value.dueAt?.toISOString(), completedAt: value.completedAt?.toISOString(), createdAt: value.createdAt.toISOString(), updatedAt: value.updatedAt.toISOString() }; }
function mapActionItem(value: PrismaActionItem): ActionItem { return { id: value.id, planId: value.planId, milestoneId: value.milestoneId ?? undefined, title: value.title, description: value.description ?? undefined, status: value.status, dueAt: value.dueAt?.toISOString(), completedAt: value.completedAt?.toISOString(), createdAt: value.createdAt.toISOString(), updatedAt: value.updatedAt.toISOString() }; }
