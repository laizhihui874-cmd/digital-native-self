import type { CreateGraphRelationRequest, GraphRelation, LifeGraphNodeType, UpdateGraphRelationRequest } from "@digital-self/shared";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { GraphRelation as PrismaGraphRelation } from "@prisma/client";
import { DefaultIdentityService } from "../identity/default-identity.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class GraphRelationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(DefaultIdentityService) private readonly identity: DefaultIdentityService) {}

  async list(): Promise<GraphRelation[]> {
    const userId = await this.identity.getCurrentUserId();
    return (await this.prisma.graphRelation.findMany({ where: { userId }, orderBy: { createdAt: "desc" } })).map(mapRelation);
  }

  async create(input: CreateGraphRelationRequest): Promise<GraphRelation> {
    const userId = await this.identity.getCurrentUserId();
    if (input.sourceType === input.targetType && input.sourceId === input.targetId) throw new BadRequestException("A node cannot be related to itself.");
    await Promise.all([this.assertOwnedNode(userId, input.sourceType, input.sourceId), this.assertOwnedNode(userId, input.targetType, input.targetId)]);
    await this.assertFragment(userId, input.evidenceFragmentId);
    assertDateRange(input.validFrom, input.validTo);
    return mapRelation(await this.prisma.graphRelation.create({ data: {
      userId, sourceType: input.sourceType, sourceId: input.sourceId, targetType: input.targetType, targetId: input.targetId,
      relationType: input.relationType.trim(), label: input.label.trim(), status: input.status ?? "confirmed",
      validFrom: input.validFrom ? new Date(input.validFrom) : null, validTo: input.validTo ? new Date(input.validTo) : null,
      evidenceFragmentId: input.evidenceFragmentId,
    } }));
  }

  async update(id: string, input: UpdateGraphRelationRequest): Promise<GraphRelation> {
    const userId = await this.identity.getCurrentUserId();
    const current = await this.prisma.graphRelation.findFirst({ where: { id, userId } });
    if (!current) throw new NotFoundException(`GraphRelation ${id} was not found.`);
    await this.assertFragment(userId, input.evidenceFragmentId);
    const validFrom = input.validFrom ?? current.validFrom?.toISOString();
    const validTo = input.validTo ?? current.validTo?.toISOString();
    assertDateRange(validFrom, validTo);
    return mapRelation(await this.prisma.graphRelation.update({ where: { id }, data: {
      relationType: input.relationType?.trim(), label: input.label?.trim(), status: input.status,
      validFrom: input.validFrom ? new Date(input.validFrom) : undefined, validTo: input.validTo ? new Date(input.validTo) : undefined,
      evidenceFragmentId: input.evidenceFragmentId,
    } }));
  }

  async delete(id: string): Promise<void> {
    const userId = await this.identity.getCurrentUserId();
    const result = await this.prisma.graphRelation.deleteMany({ where: { id, userId } });
    if (result.count === 0) throw new NotFoundException(`GraphRelation ${id} was not found.`);
  }

  private async assertOwnedNode(userId: string, type: LifeGraphNodeType, id: string) {
    const count = type === "event" ? await this.prisma.event.count({ where: { id, userId } })
      : type === "memory" ? await this.prisma.memory.count({ where: { id, userId } })
      : type === "project" ? await this.prisma.project.count({ where: { id, userId } })
      : type === "ability" ? await this.prisma.abilityNode.count({ where: { id, userId } })
      : type === "decision" ? await this.prisma.lifeDecision.count({ where: { id, userId } })
      : type === "person" ? await this.prisma.person.count({ where: { id, userId } })
      : type === "goal" ? await this.prisma.goal.count({ where: { id, userId } })
      : type === "plan" ? await this.prisma.futurePlan.count({ where: { id, userId } })
      : type === "milestone" ? await this.prisma.milestone.count({ where: { id, userId } })
      : await this.prisma.actionItem.count({ where: { id, userId } });
    if (!count) throw new NotFoundException(`${type} ${id} was not found.`);
  }

  private async assertFragment(userId: string, id?: string) {
    if (!id) return;
    const count = await this.prisma.evidenceFragment.count({ where: { id, revision: { artifact: { userId } } } });
    if (!count) throw new NotFoundException(`EvidenceFragment ${id} was not found.`);
  }
}

function assertDateRange(from?: string, to?: string) { if (from && to && new Date(to) <= new Date(from)) throw new BadRequestException("validTo must be after validFrom."); }
function mapRelation(value: PrismaGraphRelation): GraphRelation { return {
  id: value.id, sourceType: value.sourceType, sourceId: value.sourceId, targetType: value.targetType, targetId: value.targetId,
  relationType: value.relationType, label: value.label, status: value.status,
  validFrom: value.validFrom?.toISOString(), validTo: value.validTo?.toISOString(), evidenceFragmentId: value.evidenceFragmentId ?? undefined,
  createdAt: value.createdAt.toISOString(), updatedAt: value.updatedAt.toISOString(),
}; }
