import type {
  LifeGraphEdge,
  LifeGraphNode,
  LifeGraphNodeType,
  LifeGraphReviewState,
  LifeGraphSource,
  LifeGraphSubgraphResponse,
} from "@digital-self/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { SourceCitation } from "@prisma/client";

import { DefaultIdentityService } from "../identity/default-identity.service";
import type { LifeGraphSubgraphQueryDto } from "./dto/life-graph-subgraph-query.dto";
import { LifeGraphRepository } from "./life-graph.repository";

const DEFAULT_DEPTH = 2;
const DEFAULT_LIMIT = 400;
const HIDDEN_BY_DEFAULT = new Set(["candidate", "rejected", "expired", "archived", "abandoned", "cancelled"]);

type GraphRecords = Awaited<ReturnType<LifeGraphRepository["loadOwnedGraphRecords"]>>;

@Injectable()
export class LifeGraphService {
  constructor(
    @Inject(LifeGraphRepository)
    private readonly repository: LifeGraphRepository,
    @Inject(DefaultIdentityService)
    private readonly identityService: DefaultIdentityService,
  ) {}

  async getSubgraph(query: LifeGraphSubgraphQueryDto): Promise<LifeGraphSubgraphResponse> {
    const userId = await this.identityService.getCurrentUserId();
    const records = await this.repository.loadOwnedGraphRecords(userId);

    return buildLifeGraphSubgraph(records, query);
  }
}

export function buildLifeGraphSubgraph(
  records: GraphRecords,
  query: LifeGraphSubgraphQueryDto,
): LifeGraphSubgraphResponse {
  const allNodes = buildNodes(records);
  const allEdges = buildEdges(records);
  const depth = query.depth ?? DEFAULT_DEPTH;
  const limit = query.limit ?? DEFAULT_LIMIT;
  const nodeTypes = query.nodeTypes ?? [];
  const statuses = query.statuses ?? [];
  const availableDates = allNodes
    .map((node) => node.occurredAt)
    .filter((value): value is string => Boolean(value))
    .sort();

  let nodes = allNodes.filter((node) => {
    if (nodeTypes.length > 0 && !nodeTypes.includes(node.nodeType)) {
      return false;
    }

    if (statuses.length > 0 ? !statuses.includes(node.status) : HIDDEN_BY_DEFAULT.has(node.status)) {
      return false;
    }

    if (query.asOf && (node.occurredAt ?? node.createdAt) > endOfDay(query.asOf)) {
      return false;
    }

    if (node.nodeType === "ability" && !query.asOf) {
      return true;
    }

    const time = node.occurredAt ?? node.createdAt;
    return (!query.from || time >= query.from) && (!query.to || time <= endOfDay(query.to));
  });

  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  let edges = allEdges.filter((edge) => {
    if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) {
      return false;
    }

    if (statuses.length > 0 && edge.reviewState === "candidate" && !statuses.includes("candidate")) return false;
    const relation = edge.graphRelationId
      ? (records.graphRelations ?? []).find((item) => item.id === edge.graphRelationId)
      : undefined;
    const participant = edge.eventParticipantId
      ? (records.eventParticipants ?? []).find((item) => item.id === edge.eventParticipantId)
      : undefined;
    if (query.asOf && relation) {
      const asOf = endOfDay(query.asOf);
      if (relation.validFrom && relation.validFrom.toISOString() > asOf) return false;
      if (relation.validTo && relation.validTo.toISOString() <= asOf) return false;
    }
    if (query.asOf && participant) {
      const asOf = endOfDay(query.asOf);
      if (participant.validFrom && participant.validFrom.toISOString() > asOf) return false;
      if (participant.validTo && participant.validTo.toISOString() <= asOf) return false;
    }
    return true;
  });

  if (query.centerId) {
    const connectedIds = collectConnectedNodeIds(query.centerId, depth, edges);
    nodes = nodes.filter((node) => connectedIds.has(node.id));
    edges = edges.filter(
      (edge) => connectedIds.has(edge.source) && connectedIds.has(edge.target),
    );
  }

  const degrees = countDegrees(edges);
  nodes.sort((left, right) => {
    if (left.id === query.centerId) return -1;
    if (right.id === query.centerId) return 1;
    const degreeDifference = (degrees.get(right.id) ?? 0) - (degrees.get(left.id) ?? 0);
    if (degreeDifference !== 0) return degreeDifference;
    return (right.occurredAt ?? right.createdAt).localeCompare(left.occurredAt ?? left.createdAt);
  });

  const truncated = nodes.length > limit;
  nodes = nodes.slice(0, limit);
  const limitedNodeIds = new Set(nodes.map((node) => node.id));
  edges = edges.filter(
    (edge) => limitedNodeIds.has(edge.source) && limitedNodeIds.has(edge.target),
  );

  return {
    nodes,
    edges,
    summary: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      countsByType: countByNodeType(nodes),
      truncated,
    },
    availableRange: {
      from: availableDates.at(0),
      to: availableDates.at(-1),
    },
    filters: {
      centerId: query.centerId,
      depth,
      from: query.from,
      to: query.to,
      asOf: query.asOf,
      nodeTypes,
      statuses,
      limit,
    },
  };
}

function buildNodes(records: GraphRecords): LifeGraphNode[] {
  const eventsById = new Map(records.events.map((event) => [event.id, event]));
  const eventNodes = records.events.map<LifeGraphNode>((event) => ({
    id: graphId("event", event.id),
    entityId: event.id,
    nodeType: "event",
    title: event.title,
    summary: event.description ?? undefined,
    occurredAt: event.occurredAt.toISOString(),
    createdAt: event.createdAt.toISOString(),
    status: "recorded",
    reviewState: "not_required",
    importance: 1,
    source: mapSource(event.primarySourceCitation) ?? mapEventEvidenceSource(event.sources?.[0]),
  }));

  const memoryNodes = records.memories.map<LifeGraphNode>((memory) => ({
    id: graphId("memory", memory.id),
    entityId: memory.id,
    nodeType: "memory",
    title: truncate(memory.content, 56),
    summary: memory.content,
    occurredAt: memory.createdAt.toISOString(),
    createdAt: memory.createdAt.toISOString(),
    status: memory.status,
    reviewState: reviewStateFromStatus(memory.status),
    importance: 0.85 + Math.min(memory.confidence ?? 0.5, 1) * 0.35,
    source:
      mapSource(memory.sourceCitation) ??
      mapEvidenceFragmentSource(memory.evidenceSources?.[0]?.evidenceFragment),
  }));

  const projectNodes = records.projects.map<LifeGraphNode>((project) => ({
    id: graphId("project", project.id),
    entityId: project.id,
    nodeType: "project",
    title: project.name,
    summary: project.description ?? project.resumeSummary ?? undefined,
    occurredAt: (project.startDate ?? project.createdAt).toISOString(),
    createdAt: project.createdAt.toISOString(),
    status: project.status,
    reviewState: "not_required",
    importance: 1.25,
  }));

  const abilityNodes = records.abilityNodes.map<LifeGraphNode>((ability) => ({
    id: graphId("ability", ability.id),
    entityId: ability.id,
    nodeType: "ability",
    title: ability.name,
    summary: ability.description ?? undefined,
    createdAt: ability.createdAt.toISOString(),
    status: "active",
    reviewState: "not_required",
    importance: 1 + Math.min(ability.level, 5) * 0.12,
  }));

  const decisionNodes = records.decisions.map<LifeGraphNode>((decision) => ({
    id: graphId("decision", decision.id),
    entityId: decision.id,
    nodeType: "decision",
    title: decision.title,
    summary: decision.description ?? decision.finalDecision ?? undefined,
    occurredAt: decision.createdAt.toISOString(),
    createdAt: decision.createdAt.toISOString(),
    status: decision.status,
    reviewState: "not_required",
    importance: 1.4,
  }));

  const personNodes = (records.people ?? []).map<LifeGraphNode>((person) => {
    const participationDates = (records.eventParticipants ?? [])
      .filter((participant) => participant.personId === person.id)
      .map((participant) => participant.validFrom ?? eventsById.get(participant.eventId)?.occurredAt)
      .filter((value): value is Date => Boolean(value))
      .sort((left, right) => left.getTime() - right.getTime());
    return {
      id: graphId("person", person.id),
      entityId: person.id,
      nodeType: "person",
      title: person.name,
      summary: [person.relationship, person.description].filter(Boolean).join(" · ") || undefined,
      occurredAt: (person.firstMetAt ?? participationDates[0])?.toISOString(),
      createdAt: person.createdAt.toISOString(),
      status: "active",
      reviewState: "not_required",
      importance: 1.1,
    };
  });

  const goalNodes = (records.goals ?? []).map<LifeGraphNode>((goal) => ({
    id: graphId("goal", goal.id), entityId: goal.id, nodeType: "goal", title: goal.title,
    summary: [goal.area, goal.description, goal.successCriteria].filter(Boolean).join(" · ") || undefined,
    occurredAt: goal.targetDate?.toISOString(), createdAt: goal.createdAt.toISOString(), status: goal.status,
    reviewState: "not_required", importance: 1.45 + (6 - goal.priority) * 0.08,
  }));
  const planNodes = (records.futurePlans ?? []).map<LifeGraphNode>((plan) => ({
    id: graphId("plan", plan.id), entityId: plan.id, nodeType: "plan", title: plan.title,
    summary: plan.description ?? undefined, occurredAt: (plan.endDate ?? plan.startDate)?.toISOString(),
    createdAt: plan.createdAt.toISOString(), status: plan.status, reviewState: "not_required", importance: 1.2,
  }));
  const milestoneNodes = (records.milestones ?? []).map<LifeGraphNode>((milestone) => ({
    id: graphId("milestone", milestone.id), entityId: milestone.id, nodeType: "milestone", title: milestone.title,
    summary: milestone.description ?? undefined, occurredAt: milestone.dueAt?.toISOString(),
    createdAt: milestone.createdAt.toISOString(), status: milestone.status, reviewState: "not_required", importance: 1,
  }));
  const actionNodes = (records.actionItems ?? []).map<LifeGraphNode>((action) => ({
    id: graphId("action", action.id), entityId: action.id, nodeType: "action", title: action.title,
    summary: action.description ?? undefined, occurredAt: action.dueAt?.toISOString(),
    createdAt: action.createdAt.toISOString(), status: action.status, reviewState: "not_required", importance: 0.7,
  }));

  return [...eventNodes, ...memoryNodes, ...projectNodes, ...abilityNodes, ...decisionNodes, ...personNodes, ...goalNodes, ...planNodes, ...milestoneNodes, ...actionNodes];
}

function buildEdges(records: GraphRecords): LifeGraphEdge[] {
  const edges = new Map<string, LifeGraphEdge>();
  const eventsByDailyEntryId = new Map<string, string[]>();
  const eventsByEvidenceFragmentId = new Map<string, string[]>();

  for (const event of records.events) {
    if (!event.dailyEntryId) continue;
    const ids = eventsByDailyEntryId.get(event.dailyEntryId) ?? [];
    ids.push(graphId("event", event.id));
    eventsByDailyEntryId.set(event.dailyEntryId, ids);
  }

  for (const event of records.events) {
    for (const source of event.sources ?? []) {
      const ids = eventsByEvidenceFragmentId.get(source.evidenceFragmentId) ?? [];
      ids.push(graphId("event", event.id));
      eventsByEvidenceFragmentId.set(source.evidenceFragmentId, ids);
    }
  }

  for (const memory of records.memories) {
    const sources = resolveCitationNodes(memory.sourceCitation, eventsByDailyEntryId);
    for (const source of sources) {
      addEdge(edges, {
        source,
        target: graphId("memory", memory.id),
        relationType: "formed_memory",
        label: "形成记忆",
        reviewState: reviewStateFromStatus(memory.status),
        provenance: "source_citation",
        citationId: memory.sourceCitation?.id,
      });
    }
    for (const evidenceSource of memory.evidenceSources ?? []) {
      for (const source of eventsByEvidenceFragmentId.get(evidenceSource.evidenceFragmentId) ?? []) {
        addEdge(edges, {
          source,
          target: graphId("memory", memory.id),
          relationType: "formed_memory",
          label: "形成记忆",
          reviewState: reviewStateFromStatus(memory.status),
          provenance: "evidence_fragment",
          citationId: evidenceSource.evidenceFragmentId,
        });
      }
    }
  }

  for (const evidence of records.abilityEvidence) {
    const reviewState = reviewStateFromStatus(evidence.status);
    for (const source of resolveCitationNodes(evidence.sourceCitation, eventsByDailyEntryId)) {
      addEdge(edges, {
        source,
        target: graphId("ability", evidence.abilityNodeId),
        relationType: "demonstrates_ability",
        label: "体现能力",
        reviewState,
        provenance: "source_citation",
        citationId: evidence.sourceCitation?.id,
      });
    }

    for (const projectLink of evidence.projects) {
      addEdge(edges, {
        source: graphId("project", projectLink.projectId),
        target: graphId("ability", evidence.abilityNodeId),
        relationType: "project_uses_ability",
        label: "使用能力",
        reviewState,
        provenance: "database_relation",
      });
    }
  }

  for (const ability of records.abilityNodes) {
    if (!ability.parentId) continue;
    addEdge(edges, {
      source: graphId("ability", ability.parentId),
      target: graphId("ability", ability.id),
      relationType: "ability_parent",
      label: "包含能力",
      reviewState: "not_required",
      provenance: "database_relation",
    });
  }

  for (const decision of records.decisions) {
    for (const evidence of decision.evidenceItems) {
      for (const source of resolveCitationNodes(evidence.sourceCitation, eventsByDailyEntryId)) {
        addEdge(edges, {
          source,
          target: graphId("decision", decision.id),
          relationType: "influenced_decision",
          label: "影响决策",
          reviewState: "not_required",
          provenance: "source_citation",
          citationId: evidence.sourceCitation?.id,
        });
      }
    }
  }

  for (const relation of records.graphRelations ?? []) {
    if (relation.status === "rejected") continue;
    addEdge(edges, {
      source: graphId(relation.sourceType, relation.sourceId),
      target: graphId(relation.targetType, relation.targetId),
      relationType: "manual_relation",
      label: relation.label,
      reviewState: reviewStateFromStatus(relation.status),
      provenance: "manual_relation",
      citationId: relation.evidenceFragmentId ?? undefined,
      graphRelationId: relation.id,
    });
  }

  for (const participant of records.eventParticipants ?? []) {
    addEdge(edges, {
      source: graphId("person", participant.personId),
      target: graphId("event", participant.eventId),
      relationType: "participated_in_event",
      label: participant.role?.trim() || "参与事件",
      reviewState: "not_required",
      provenance: participant.evidenceFragmentId ? "evidence_fragment" : "database_relation",
      citationId: participant.evidenceFragmentId ?? undefined,
      eventParticipantId: participant.id,
    });
  }

  for (const plan of records.futurePlans ?? []) {
    addEdge(edges, { source: graphId("goal", plan.goalId), target: graphId("plan", plan.id), relationType: "goal_has_plan", label: "拆成计划", reviewState: "not_required", provenance: "database_relation" });
  }
  for (const milestone of records.milestones ?? []) {
    addEdge(edges, { source: graphId("plan", milestone.planId), target: graphId("milestone", milestone.id), relationType: "plan_has_milestone", label: "包含里程碑", reviewState: "not_required", provenance: "database_relation" });
  }
  for (const action of records.actionItems ?? []) {
    addEdge(edges, {
      source: action.milestoneId ? graphId("milestone", action.milestoneId) : graphId("plan", action.planId),
      target: graphId("action", action.id),
      relationType: action.milestoneId ? "milestone_has_action" : "plan_has_action",
      label: "下一步行动", reviewState: "not_required", provenance: "database_relation",
    });
  }

  return Array.from(edges.values());
}

function resolveCitationNodes(
  citation: SourceCitation | null,
  eventsByDailyEntryId: Map<string, string[]>,
): string[] {
  if (!citation) return [];
  if (citation.sourceType === "daily_entry") {
    return eventsByDailyEntryId.get(citation.sourceId) ?? [];
  }
  if (citation.sourceType === "event") return [graphId("event", citation.sourceId)];
  if (citation.sourceType === "project") return [graphId("project", citation.sourceId)];
  return [];
}

function addEdge(
  edges: Map<string, LifeGraphEdge>,
  edge: Omit<LifeGraphEdge, "id">,
): void {
  const id = edge.graphRelationId ?? edge.eventParticipantId ?? `${edge.relationType}:${edge.source}:${edge.target}:${edge.citationId ?? "direct"}`;
  edges.set(id, { id, ...edge });
}

function collectConnectedNodeIds(centerId: string, depth: number, edges: LifeGraphEdge[]): Set<string> {
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    const sourceNeighbors = adjacency.get(edge.source) ?? new Set<string>();
    sourceNeighbors.add(edge.target);
    adjacency.set(edge.source, sourceNeighbors);
    const targetNeighbors = adjacency.get(edge.target) ?? new Set<string>();
    targetNeighbors.add(edge.source);
    adjacency.set(edge.target, targetNeighbors);
  }

  const visited = new Set<string>([centerId]);
  let frontier = new Set<string>([centerId]);
  for (let level = 0; level < depth; level += 1) {
    const next = new Set<string>();
    for (const id of frontier) {
      for (const neighbor of adjacency.get(id) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          next.add(neighbor);
        }
      }
    }
    frontier = next;
  }
  return visited;
}

function countByNodeType(nodes: LifeGraphNode[]): Partial<Record<LifeGraphNodeType, number>> {
  return nodes.reduce<Partial<Record<LifeGraphNodeType, number>>>((counts, node) => {
    counts[node.nodeType] = (counts[node.nodeType] ?? 0) + 1;
    return counts;
  }, {});
}

function countDegrees(edges: LifeGraphEdge[]): Map<string, number> {
  const degrees = new Map<string, number>();
  for (const edge of edges) {
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
  }
  return degrees;
}

function reviewStateFromStatus(status: string): LifeGraphReviewState {
  if (status === "confirmed") return "confirmed";
  if (status === "candidate") return "candidate";
  return "not_required";
}

function mapSource(citation: SourceCitation | null): LifeGraphSource | undefined {
  if (!citation) return undefined;
  return {
    citationId: citation.id,
    sourceType: citation.sourceType,
    sourceId: citation.sourceId,
    title: citation.title ?? undefined,
    excerpt: citation.excerpt ?? undefined,
    locator: citation.locator ?? undefined,
  };
}

function mapEventEvidenceSource(
  source: GraphRecords["events"][number]["sources"][number] | undefined,
): LifeGraphSource | undefined {
  if (!source) return undefined;
  return mapEvidenceFragmentSource(source.evidenceFragment);
}

function mapEvidenceFragmentSource(
  fragment:
    | GraphRecords["events"][number]["sources"][number]["evidenceFragment"]
    | GraphRecords["memories"][number]["evidenceSources"][number]["evidenceFragment"]
    | undefined,
): LifeGraphSource | undefined {
  if (!fragment) return undefined;
  const artifact = fragment.revision.artifact;
  return {
    citationId: fragment.id,
    sourceType: "evidence_fragment",
    sourceId: fragment.id,
    title: artifact.title ?? "原始证据片段",
    excerpt: fragment.content,
    locator: fragment.locator ? JSON.stringify(fragment.locator) : undefined,
  };
}

function graphId(type: LifeGraphNodeType, entityId: string): string {
  return `${type}:${entityId}`;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function endOfDay(value: string): string {
  return value.length === 10 ? `${value}T23:59:59.999Z` : value;
}
