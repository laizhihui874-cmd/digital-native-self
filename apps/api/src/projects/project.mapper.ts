import type { Project, ProjectDetail } from "@digital-self/shared";
import type { Prisma } from "@prisma/client";

import { mapAbilityEvidence } from "../ability-evidence/ability-evidence.mapper";

type ProjectRecord = Prisma.ProjectGetPayload<Record<string, never>>;
type ProjectDetailRecord = Prisma.ProjectGetPayload<{
  include: {
    abilityEvidence: {
      include: {
        abilityEvidence: true;
      };
    };
  };
}>;

export function mapProject(record: ProjectRecord): Project {
  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    description: record.description,
    role: record.role,
    startDate: record.startDate?.toISOString() ?? null,
    endDate: record.endDate?.toISOString() ?? null,
    status: record.status,
    outcomes: parseOutcomes(record.outcomes),
    resumeSummary: record.resumeSummary,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function mapProjectDetail(record: ProjectDetailRecord): ProjectDetail {
  return {
    ...mapProject(record),
    abilityEvidenceItems: record.abilityEvidence.map((item) =>
      mapAbilityEvidence(item.abilityEvidence),
    ),
  };
}

function parseOutcomes(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}
