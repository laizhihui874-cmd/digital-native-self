import type { ArchiveSearchContext } from "@digital-self/shared";
import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import type { SearchDocument } from "./archive-search.types";

@Injectable()
export class ArchiveSearchRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async contextExists(userId: string, context: ArchiveSearchContext): Promise<boolean> {
    const where = { id: context.entityId, userId };
    switch (context.entityType) {
      case "event": return Boolean(await this.prisma.event.findFirst({ where, select: { id: true } }));
      case "memory": return Boolean(await this.prisma.memory.findFirst({ where, select: { id: true } }));
      case "project": return Boolean(await this.prisma.project.findFirst({ where, select: { id: true } }));
      case "ability": return Boolean(await this.prisma.abilityNode.findFirst({ where, select: { id: true } }));
      case "decision": return Boolean(await this.prisma.lifeDecision.findFirst({ where, select: { id: true } }));
      case "person": return Boolean(await this.prisma.person.findFirst({ where, select: { id: true } }));
      case "goal": return Boolean(await this.prisma.goal.findFirst({ where, select: { id: true } }));
      case "plan": return Boolean(await this.prisma.futurePlan.findFirst({ where, select: { id: true } }));
      case "milestone": return Boolean(await this.prisma.milestone.findFirst({ where, select: { id: true } }));
      case "action": return Boolean(await this.prisma.actionItem.findFirst({ where, select: { id: true } }));
      case "artifact": return Boolean(await this.prisma.evidenceArtifact.findFirst({ where, select: { id: true } }));
    }
  }

  async collect(userId: string): Promise<SearchDocument[]> {
    const [
      dailyEntries,
      artifacts,
      events,
      memories,
      projects,
      abilityEvidence,
      decisions,
      people,
      goals,
      plans,
      milestones,
      actions,
      weeklyReviews,
      graphRelations,
    ] = await Promise.all([
      this.prisma.dailyEntry.findMany({ where: { userId }, select: { id: true, rawContent: true, recordedAt: true, createdAt: true } }),
      this.prisma.evidenceArtifact.findMany({
        where: { userId },
        select: {
          id: true, title: true, artifactType: true, capturedAt: true, createdAt: true,
          revisions: { orderBy: [{ revisionNumber: "desc" }], select: { id: true, revisionType: true, content: true, createdAt: true, fragments: { orderBy: { fragmentIndex: "asc" }, select: { id: true, content: true, locator: true } } } },
        },
      }),
      this.prisma.event.findMany({ where: { userId, recordStatus: { in: ["confirmed", "disputed"] } }, select: { id: true, title: true, description: true, eventType: true, occurredAt: true, endedAt: true, recordStatus: true } }),
      this.prisma.memory.findMany({ where: { userId, status: "confirmed" }, select: { id: true, memoryType: true, content: true, createdAt: true, status: true } }),
      this.prisma.project.findMany({ where: { userId }, select: { id: true, name: true, description: true, role: true, outcomes: true, resumeSummary: true, startDate: true, endDate: true, status: true } }),
      this.prisma.abilityEvidence.findMany({ where: { userId, status: "confirmed" }, select: { id: true, content: true, impact: true, createdAt: true, status: true, abilityNode: { select: { id: true, name: true, description: true } } } }),
      this.prisma.lifeDecision.findMany({ where: { userId }, select: { id: true, title: true, description: true, finalDecision: true, deadline: true, status: true, paths: { select: { title: true, description: true, benefits: true, risks: true } }, evidenceItems: { select: { evidenceType: true, content: true } } } }),
      this.prisma.person.findMany({ where: { userId }, select: { id: true, name: true, relationship: true, description: true, firstMetAt: true } }),
      this.prisma.goal.findMany({ where: { userId, status: { in: ["active", "achieved", "paused"] } }, select: { id: true, title: true, description: true, area: true, successCriteria: true, targetDate: true, status: true } }),
      this.prisma.futurePlan.findMany({ where: { userId, status: { in: ["active", "completed", "paused"] } }, select: { id: true, title: true, description: true, startDate: true, endDate: true, status: true, goal: { select: { id: true, title: true } } } }),
      this.prisma.milestone.findMany({ where: { userId }, select: { id: true, title: true, description: true, dueAt: true, completedAt: true, status: true, plan: { select: { id: true, title: true, goalId: true } } } }),
      this.prisma.actionItem.findMany({ where: { userId, status: { not: "cancelled" } }, select: { id: true, title: true, description: true, dueAt: true, completedAt: true, status: true, plan: { select: { id: true, title: true, goalId: true } }, milestoneId: true } }),
      this.prisma.weeklyReview.findMany({ where: { userId }, select: { id: true, periodStart: true, periodEnd: true, progressSummary: true, abilityChanges: true, emotionPatterns: true, goalDrift: true, nextWeekSuggestions: true, lifePossibilityNotes: true, lifeDecisionId: true } }),
      this.prisma.graphRelation.findMany({ where: { userId, status: "confirmed" }, select: { sourceType: true, sourceId: true, targetType: true, targetId: true } }),
    ]);

    const refs = (entityType: string, entityId: string) => {
      const result = [{ entityType, entityId }];
      for (const relation of graphRelations) {
        if (relation.sourceType === entityType && relation.sourceId === entityId) result.push({ entityType: relation.targetType, entityId: relation.targetId });
        if (relation.targetType === entityType && relation.targetId === entityId) result.push({ entityType: relation.sourceType, entityId: relation.sourceId });
      }
      return uniqueRefs(result);
    };

    const documents: SearchDocument[] = [];
    for (const entry of dailyEntries) documents.push({ sourceType: "daily_entry", sourceId: entry.id, title: `每日记录 · ${formatDate(entry.recordedAt ?? entry.createdAt)}`, content: entry.rawContent, occurredAt: (entry.recordedAt ?? entry.createdAt).toISOString(), contextRefs: [] });
    for (const artifact of artifacts) {
      const revision = artifact.revisions.find((item) => item.revisionType === "parsed") ?? artifact.revisions[0];
      if (!revision) continue;
      if (revision.fragments.length) {
        for (const fragment of revision.fragments) documents.push({ sourceType: "evidence_fragment", sourceId: fragment.id, sourceVersionId: revision.id, title: artifact.title ?? `原始资料 · ${artifact.artifactType}`, content: fragment.content, occurredAt: (artifact.capturedAt ?? artifact.createdAt).toISOString(), locator: stringifyLocator(fragment.locator), contextRefs: [{ entityType: "artifact", entityId: artifact.id }] });
      } else if (revision.content) {
        documents.push({ sourceType: "imported_file", sourceId: artifact.id, sourceVersionId: revision.id, title: artifact.title ?? `原始资料 · ${artifact.artifactType}`, content: revision.content, occurredAt: (artifact.capturedAt ?? artifact.createdAt).toISOString(), contextRefs: [{ entityType: "artifact", entityId: artifact.id }] });
      }
    }
    for (const event of events) documents.push({ sourceType: "event", sourceId: event.id, title: event.title, content: joinContent(event.description, event.eventType, event.endedAt?.toISOString()), occurredAt: event.occurredAt.toISOString(), status: event.recordStatus, contextRefs: refs("event", event.id) });
    for (const memory of memories) documents.push({ sourceType: "memory", sourceId: memory.id, title: `长期记忆 · ${memory.memoryType}`, content: memory.content, occurredAt: memory.createdAt.toISOString(), status: memory.status, contextRefs: refs("memory", memory.id) });
    for (const project of projects) documents.push({ sourceType: "project", sourceId: project.id, title: project.name, content: joinContent(project.description, project.role, project.outcomes, project.resumeSummary), occurredAt: project.startDate?.toISOString(), status: project.status, contextRefs: refs("project", project.id) });
    for (const evidence of abilityEvidence) documents.push({ sourceType: "ability_evidence", sourceId: evidence.id, title: `能力证据 · ${evidence.abilityNode.name}`, content: joinContent(evidence.abilityNode.description, evidence.content, evidence.impact), occurredAt: evidence.createdAt.toISOString(), status: evidence.status, contextRefs: uniqueRefs([...refs("ability", evidence.abilityNode.id), { entityType: "ability", entityId: evidence.abilityNode.id }]) });
    for (const decision of decisions) documents.push({ sourceType: "life_decision", sourceId: decision.id, title: decision.title, content: joinContent(decision.description, decision.finalDecision, decision.paths, decision.evidenceItems), occurredAt: decision.deadline?.toISOString(), status: decision.status, contextRefs: refs("decision", decision.id) });
    for (const person of people) documents.push({ sourceType: "person", sourceId: person.id, title: person.name, content: joinContent(person.relationship, person.description), occurredAt: person.firstMetAt?.toISOString(), contextRefs: refs("person", person.id) });
    for (const goal of goals) documents.push({ sourceType: "goal", sourceId: goal.id, title: goal.title, content: joinContent(goal.description, goal.area, goal.successCriteria), occurredAt: goal.targetDate?.toISOString(), status: goal.status, contextRefs: refs("goal", goal.id) });
    for (const plan of plans) documents.push({ sourceType: "plan", sourceId: plan.id, title: plan.title, content: joinContent(plan.description, `所属目标：${plan.goal.title}`), occurredAt: plan.startDate?.toISOString() ?? plan.endDate?.toISOString(), status: plan.status, contextRefs: uniqueRefs([...refs("plan", plan.id), { entityType: "goal", entityId: plan.goal.id }]) });
    for (const milestone of milestones) documents.push({ sourceType: "milestone", sourceId: milestone.id, title: milestone.title, content: joinContent(milestone.description, `所属计划：${milestone.plan.title}`), occurredAt: milestone.completedAt?.toISOString() ?? milestone.dueAt?.toISOString(), status: milestone.status, contextRefs: uniqueRefs([...refs("milestone", milestone.id), { entityType: "plan", entityId: milestone.plan.id }, { entityType: "goal", entityId: milestone.plan.goalId }]) });
    for (const action of actions) documents.push({ sourceType: "action", sourceId: action.id, title: action.title, content: joinContent(action.description, `所属计划：${action.plan.title}`), occurredAt: action.completedAt?.toISOString() ?? action.dueAt?.toISOString(), status: action.status, contextRefs: uniqueRefs([...refs("action", action.id), { entityType: "plan", entityId: action.plan.id }, { entityType: "goal", entityId: action.plan.goalId }, ...(action.milestoneId ? [{ entityType: "milestone", entityId: action.milestoneId }] : [])]) });
    for (const review of weeklyReviews) documents.push({ sourceType: "weekly_review", sourceId: review.id, title: `周复盘 · ${formatDate(review.periodStart)}—${formatDate(review.periodEnd)}`, content: joinContent(review.progressSummary, review.abilityChanges, review.emotionPatterns, review.goalDrift, review.nextWeekSuggestions, review.lifePossibilityNotes), occurredAt: review.periodEnd.toISOString(), contextRefs: review.lifeDecisionId ? [{ entityType: "decision", entityId: review.lifeDecisionId }] : [] });
    return documents;
  }
}

function joinContent(...values: unknown[]): string {
  return values.filter((value) => value !== null && value !== undefined && value !== "").map((value) => typeof value === "string" ? value : JSON.stringify(value)).join("\n");
}
function formatDate(value: Date): string { return value.toISOString().slice(0, 10); }
function stringifyLocator(value: unknown): string | undefined { return value ? (typeof value === "string" ? value : JSON.stringify(value)) : undefined; }
function uniqueRefs(values: Array<{ entityType: string; entityId: string }>) { return Array.from(new Map(values.map((value) => [`${value.entityType}:${value.entityId}`, value])).values()); }
