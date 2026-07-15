import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class LifeGraphRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async loadOwnedGraphRecords(userId: string) {
    const [events, memories, projects, abilityNodes, abilityEvidence, decisions, graphRelations, people, eventParticipants, goals, futurePlans, milestones, actionItems] =
      await this.prisma.$transaction([
        this.prisma.event.findMany({
          where: { userId },
          include: {
            primarySourceCitation: true,
            sources: {
              include: {
                evidenceFragment: {
                  include: { revision: { include: { artifact: true } } },
                },
              },
              orderBy: [{ role: "asc" }, { createdAt: "asc" }],
            },
          },
          orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        }),
        this.prisma.memory.findMany({
          where: { userId },
          include: {
            sourceCitation: true,
            evidenceSources: {
              include: {
                evidenceFragment: {
                  include: { revision: { include: { artifact: true } } },
                },
              },
              orderBy: [{ role: "asc" }, { createdAt: "asc" }],
            },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
        this.prisma.project.findMany({
          where: { userId },
          orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
        }),
        this.prisma.abilityNode.findMany({
          where: { userId },
          orderBy: [{ level: "desc" }, { createdAt: "desc" }],
        }),
        this.prisma.abilityEvidence.findMany({
          where: { userId },
          include: {
            sourceCitation: true,
            projects: true,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
        this.prisma.lifeDecision.findMany({
          where: { userId },
          include: {
            evidenceItems: {
              include: { sourceCitation: true },
            },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
        this.prisma.graphRelation.findMany({
          where: { userId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
        this.prisma.person.findMany({ where: { userId }, orderBy: [{ name: "asc" }, { id: "asc" }] }),
        this.prisma.eventParticipant.findMany({
          where: { event: { userId } },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        }),
        this.prisma.goal.findMany({ where: { userId }, orderBy: [{ priority: "asc" }, { targetDate: "asc" }] }),
        this.prisma.futurePlan.findMany({ where: { userId }, orderBy: [{ endDate: "asc" }, { createdAt: "asc" }] }),
        this.prisma.milestone.findMany({ where: { userId }, orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }] }),
        this.prisma.actionItem.findMany({ where: { userId }, orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }] }),
      ]);

    return {
      events,
      memories,
      projects,
      abilityNodes,
      abilityEvidence,
      decisions,
      graphRelations,
      people,
      eventParticipants,
      goals,
      futurePlans,
      milestones,
      actionItems,
    };
  }
}
