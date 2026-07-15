import type { AbilityNode, AbilityNodeDetail } from "@digital-self/shared";
import type {
  AbilityEvidence as PrismaAbilityEvidence,
  AbilityNode as PrismaAbilityNode,
} from "@prisma/client";

import { mapAbilityEvidence } from "../ability-evidence/ability-evidence.mapper";

export function mapAbilityNode(record: PrismaAbilityNode): AbilityNode {
  return {
    id: record.id,
    userId: record.userId,
    parentId: record.parentId,
    name: record.name,
    description: record.description,
    level: record.level,
    origin: record.origin,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function mapAbilityNodeForest(
  records: PrismaAbilityNode[],
  evidenceRecords: PrismaAbilityEvidence[] = [],
): AbilityNodeDetail[] {
  const detailById = new Map<string, AbilityNodeDetail>();

  for (const record of records) {
    detailById.set(record.id, {
      ...mapAbilityNode(record),
      evidenceItems: [],
      children: [],
    });
  }

  for (const evidenceRecord of evidenceRecords) {
    const detail = detailById.get(evidenceRecord.abilityNodeId);

    if (!detail) {
      continue;
    }

    detail.evidenceItems.push(mapAbilityEvidence(evidenceRecord));
  }

  const roots: AbilityNodeDetail[] = [];

  for (const record of records) {
    const detail = detailById.get(record.id);

    if (!detail) {
      continue;
    }

    if (record.parentId) {
      const parent = detailById.get(record.parentId);

      if (parent) {
        parent.children.push(detail);
        continue;
      }
    }

    roots.push(detail);
  }

  return roots;
}

export function findAbilityNodeInForest(
  forest: AbilityNodeDetail[],
  targetId: string,
): AbilityNodeDetail | null {
  for (const node of forest) {
    if (node.id === targetId) {
      return node;
    }

    const childMatch = findAbilityNodeInForest(node.children, targetId);

    if (childMatch) {
      return childMatch;
    }
  }

  return null;
}
