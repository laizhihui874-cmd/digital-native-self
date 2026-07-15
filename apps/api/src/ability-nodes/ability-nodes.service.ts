import type {
  AbilityNodeDetail,
  CreateAbilityNodeRequest,
  ListAbilityNodesResponse,
  UpdateAbilityNodeRequest,
} from "@digital-self/shared";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { DefaultIdentityService } from "../identity/default-identity.service";
import {
  findAbilityNodeInForest,
  mapAbilityNodeForest,
} from "./ability-node.mapper";
import { AbilityNodesRepository, type AbilityNodeFlatRecord } from "./ability-nodes.repository";

@Injectable()
export class AbilityNodesService {
  constructor(
    @Inject(AbilityNodesRepository)
    private readonly abilityNodesRepository: AbilityNodesRepository,
    @Inject(DefaultIdentityService)
    private readonly identityService: DefaultIdentityService,
  ) {}

  async create(input: CreateAbilityNodeRequest): Promise<AbilityNodeDetail> {
    const userId = await this.identityService.getCurrentUserId();
    const parent = input.parentId
      ? await this.abilityNodesRepository.findFlatRecordById(userId, input.parentId)
      : null;

    if (input.parentId && !parent) {
      throw new NotFoundException(`AbilityNode parent ${input.parentId} was not found.`);
    }

    await this.assertNameAvailable(userId, input.parentId ?? null, input.name);

    const createdNode = await this.abilityNodesRepository.create(userId, {
      name: input.name,
      description: input.description,
      parentId: input.parentId ?? null,
      level: parent ? parent.level + 1 : 1,
      origin: "custom",
    });

    return this.findDetailById(userId, createdNode.id);
  }

  async list(): Promise<ListAbilityNodesResponse> {
    const userId = await this.identityService.getCurrentUserId();
    const records = await this.abilityNodesRepository.listTreeRecords(userId);
    const evidenceRecords = await this.abilityNodesRepository.listEvidenceRecords(
      userId,
      records.map((record) => record.id),
    );

    return {
      items: mapAbilityNodeForest(records, evidenceRecords),
    };
  }

  async findById(id: string): Promise<AbilityNodeDetail> {
    const userId = await this.identityService.getCurrentUserId();
    return this.findDetailById(userId, id);
  }

  async update(id: string, input: UpdateAbilityNodeRequest): Promise<AbilityNodeDetail> {
    const userId = await this.identityService.getCurrentUserId();
    const flatNodes = await this.abilityNodesRepository.listFlatRecords(userId);
    const currentNode = flatNodes.find((node) => node.id === id);

    if (!currentNode) {
      throw new NotFoundException(`AbilityNode ${id} was not found.`);
    }

    const hasParentUpdate = input.parentId !== undefined;
    const hasDescriptionUpdate = input.description !== undefined;
    const nextParentId = hasParentUpdate ? input.parentId ?? null : currentNode.parentId;

    if (nextParentId === currentNode.id) {
      throw new BadRequestException("An ability node cannot be moved under itself.");
    }

    const descendants = collectDescendants(flatNodes, currentNode.id);

    if (nextParentId && descendants.some((node) => node.id === nextParentId)) {
      throw new BadRequestException("An ability node cannot be moved under one of its descendants.");
    }

    const parent = nextParentId
      ? flatNodes.find((node) => node.id === nextParentId) ?? null
      : null;

    if (nextParentId && !parent) {
      throw new NotFoundException(`AbilityNode parent ${nextParentId} was not found.`);
    }

    const nextName = input.name ?? currentNode.name;
    const nextDescription = hasDescriptionUpdate ? input.description ?? null : currentNode.description;
    const nextLevel = parent ? parent.level + 1 : 1;

    if (nextName !== currentNode.name || nextParentId !== currentNode.parentId) {
      await this.assertNameAvailable(userId, nextParentId, nextName, currentNode.id);
    }

    const levelDelta = nextLevel - currentNode.level;

    await this.abilityNodesRepository.updateNodeAndDescendantLevels({
      id: currentNode.id,
      name: nextName,
      description: nextDescription,
      parentId: nextParentId,
      level: nextLevel,
      descendants:
        levelDelta === 0
          ? []
          : descendants.map((node) => ({
              id: node.id,
              level: node.level + levelDelta,
            })),
    });

    return this.findDetailById(userId, id);
  }

  async delete(id: string): Promise<void> {
    const userId = await this.identityService.getCurrentUserId();
    const deleted = await this.abilityNodesRepository.delete(userId, id);

    if (!deleted) {
      throw new NotFoundException(`AbilityNode ${id} was not found.`);
    }
  }

  private async findDetailById(userId: string, id: string): Promise<AbilityNodeDetail> {
    const records = await this.abilityNodesRepository.listTreeRecords(userId);
    const evidenceRecords = await this.abilityNodesRepository.listEvidenceRecords(
      userId,
      records.map((record) => record.id),
    );
    const forest = mapAbilityNodeForest(records, evidenceRecords);
    const node = findAbilityNodeInForest(forest, id);

    if (!node) {
      throw new NotFoundException(`AbilityNode ${id} was not found.`);
    }

    return node;
  }

  private async assertNameAvailable(
    userId: string,
    parentId: string | null,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const conflictingNode = await this.abilityNodesRepository.findSiblingByName(
      userId,
      parentId,
      name,
      excludeId,
    );

    if (conflictingNode) {
      throw new ConflictException(
        `AbilityNode '${name}' already exists under parent ${parentId ?? "root"}.`,
      );
    }
  }
}

function collectDescendants(nodes: AbilityNodeFlatRecord[], rootId: string): AbilityNodeFlatRecord[] {
  const childIdsByParentId = new Map<string, string[]>();

  for (const node of nodes) {
    if (!node.parentId) {
      continue;
    }

    const existingChildren = childIdsByParentId.get(node.parentId) ?? [];
    existingChildren.push(node.id);
    childIdsByParentId.set(node.parentId, existingChildren);
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const descendants: AbilityNodeFlatRecord[] = [];
  const stack = [...(childIdsByParentId.get(rootId) ?? [])];

  while (stack.length > 0) {
    const currentId = stack.pop();

    if (!currentId) {
      continue;
    }

    const currentNode = nodeById.get(currentId);

    if (!currentNode) {
      continue;
    }

    descendants.push(currentNode);

    for (const childId of childIdsByParentId.get(currentId) ?? []) {
      stack.push(childId);
    }
  }

  return descendants;
}
