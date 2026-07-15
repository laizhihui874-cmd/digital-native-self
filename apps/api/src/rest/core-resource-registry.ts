export type RestMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type RestResourceContract = {
  resource: string;
  method: RestMethod;
  path: string;
  summary: string;
};

export const coreResourceRegistry: RestResourceContract[] = [
  {
    resource: "life-graph",
    method: "GET",
    path: "/api/life-graph/subgraph",
    summary: "Build a filtered local graph from owned events, memories, projects, abilities, decisions, and explicit source links.",
  },
  {
    resource: "daily-entry",
    method: "POST",
    path: "/api/daily-entries",
    summary: "Create a raw daily entry from Feishu, Web, or imported history.",
  },
  {
    resource: "daily-entry",
    method: "GET",
    path: "/api/daily-entries/:id",
    summary: "Fetch a daily entry with its structured report, metrics, and extracted events.",
  },
  {
    resource: "daily-entry",
    method: "GET",
    path: "/api/daily-entries",
    summary: "List daily entries for the current MVP user with optional date filtering.",
  },
  {
    resource: "metric-rating",
    method: "POST",
    path: "/api/daily-entries/:dailyEntryId/metric-ratings",
    summary: "Create or update a metric rating for an owned daily entry keyed by metricType.",
  },
  {
    resource: "metric-rating",
    method: "GET",
    path: "/api/daily-entries/:dailyEntryId/metric-ratings",
    summary: "List all metric ratings associated with an owned daily entry.",
  },
  {
    resource: "structured-daily-report",
    method: "POST",
    path: "/api/structured-daily-reports",
    summary: "Create a structured daily report for an owned daily entry from caller-provided structured content.",
  },
  {
    resource: "structured-daily-report",
    method: "GET",
    path: "/api/structured-daily-reports/:dailyEntryId",
    summary: "Fetch the structured daily report associated with an owned daily entry.",
  },
  {
    resource: "memory",
    method: "POST",
    path: "/api/memories",
    summary: "Create a candidate or confirmed memory record for the current MVP user. Default status is candidate.",
  },
  {
    resource: "memory",
    method: "GET",
    path: "/api/memories",
    summary: "List memories for the current MVP user with status/type filters, ordered by createdAt desc.",
  },
  {
    resource: "memory",
    method: "GET",
    path: "/api/memories/:id",
    summary: "Fetch a single memory belonging to the current MVP user.",
  },
  {
    resource: "memory-review",
    method: "PATCH",
    path: "/api/memories/:id/review",
    summary: "Confirm, reject, edit, or expire a memory candidate.",
  },
  {
    resource: "memory",
    method: "DELETE",
    path: "/api/memories/:id",
    summary: "Permanently delete a memory owned by the current MVP user.",
  },
  {
    resource: "life-decision",
    method: "POST",
    path: "/api/life-decisions",
    summary: "Create a top-level life decision case.",
  },
  {
    resource: "life-decision",
    method: "GET",
    path: "/api/life-decisions",
    summary: "List life decisions for the current MVP user with an optional status filter.",
  },
  {
    resource: "life-decision",
    method: "GET",
    path: "/api/life-decisions/:id",
    summary: "Fetch one owned life decision with its candidate paths and related evidence arrays.",
  },
  {
    resource: "life-decision",
    method: "PATCH",
    path: "/api/life-decisions/:id",
    summary: "Update the core fields of an owned life decision, including final decision text.",
  },
  {
    resource: "external-source",
    method: "POST",
    path: "/api/external-sources",
    summary: "Create an external source record with a required link and an optional owned life-decision association.",
  },
  {
    resource: "external-source",
    method: "GET",
    path: "/api/external-sources",
    summary: "List owned external source records with pagination and an optional lifeDecisionId filter.",
  },
  {
    resource: "external-source",
    method: "GET",
    path: "/api/external-sources/:id",
    summary: "Fetch a single owned external source record.",
  },
  {
    resource: "external-source",
    method: "PATCH",
    path: "/api/external-sources/:id",
    summary: "Update supported fields on an owned external source and optionally rebind it to another owned life decision.",
  },
  {
    resource: "external-source",
    method: "DELETE",
    path: "/api/external-sources/:id",
    summary: "Permanently delete an owned external source record.",
  },
  {
    resource: "decision-path",
    method: "POST",
    path: "/api/life-decisions/:decisionId/paths",
    summary: "Create a candidate path under a life decision.",
  },
  {
    resource: "decision-path",
    method: "PATCH",
    path: "/api/life-decisions/:decisionId/paths/:pathId",
    summary: "Update a candidate path under an owned life decision.",
  },
  {
    resource: "decision-evidence",
    method: "POST",
    path: "/api/decision-evidence",
    summary: "Attach support, against, or neutral evidence to a decision path.",
  },
  {
    resource: "decision-evidence",
    method: "GET",
    path: "/api/decision-evidence",
    summary: "List owned decision evidence records with optional decisionId and pathId filters.",
  },
  {
    resource: "decision-evidence",
    method: "GET",
    path: "/api/decision-evidence/:id",
    summary: "Fetch a single owned decision evidence record.",
  },
  {
    resource: "decision-evidence",
    method: "PATCH",
    path: "/api/decision-evidence/:id",
    summary: "Update the supported fields of an owned decision evidence record.",
  },
  {
    resource: "decision-evidence",
    method: "DELETE",
    path: "/api/decision-evidence/:id",
    summary: "Permanently delete an owned decision evidence record.",
  },
  {
    resource: "ability-node",
    method: "POST",
    path: "/api/ability-nodes",
    summary: "Create a root or nested ability node.",
  },
  {
    resource: "ability-node",
    method: "GET",
    path: "/api/ability-nodes",
    summary: "List the current user's full ability tree with multi-level children.",
  },
  {
    resource: "ability-node",
    method: "GET",
    path: "/api/ability-nodes/:id",
    summary: "Fetch one owned ability node subtree with all nested descendants.",
  },
  {
    resource: "ability-node",
    method: "PATCH",
    path: "/api/ability-nodes/:id",
    summary: "Rename, reparent, or edit an owned ability node and recalculate subtree levels.",
  },
  {
    resource: "ability-node",
    method: "DELETE",
    path: "/api/ability-nodes/:id",
    summary: "Delete an owned ability node using the existing schema delete behavior.",
  },
  {
    resource: "ability-evidence",
    method: "POST",
    path: "/api/ability-evidence",
    summary: "Create a candidate ability evidence record for later confirmation.",
  },
  {
    resource: "ability-evidence",
    method: "GET",
    path: "/api/ability-evidence",
    summary: "List owned ability evidence records with optional ability-node and status filters.",
  },
  {
    resource: "ability-evidence",
    method: "GET",
    path: "/api/ability-evidence/:id",
    summary: "Fetch a single owned ability evidence record.",
  },
  {
    resource: "ability-evidence-review",
    method: "PATCH",
    path: "/api/ability-evidence/:id/review",
    summary: "Confirm or reject a candidate ability evidence record while correcting its fields.",
  },
  {
    resource: "ability-evidence",
    method: "DELETE",
    path: "/api/ability-evidence/:id",
    summary: "Permanently delete an owned ability evidence record.",
  },
  {
    resource: "weekly-review",
    method: "POST",
    path: "/api/weekly-reviews",
    summary: "Persist a generated weekly review and linked emotion pattern.",
  },
  {
    resource: "imported-file",
    method: "POST",
    path: "/api/imported-files/text",
    summary:
      "Archive pasted history text as an imported-file record for later user-reviewed extraction, without auto-promoting it into memory, resume material, or decision evidence.",
  },
  {
    resource: "imported-file",
    method: "POST",
    path: "/api/imported-files/file",
    summary:
      "Upload a history file, parse supported text content, and persist an imported-file archive record without auto-confirming any downstream knowledge.",
  },
  {
    resource: "imported-file",
    method: "GET",
    path: "/api/imported-files",
    summary: "List owned imported-file archive records with pagination and an optional source-type filter.",
  },
  {
    resource: "imported-file",
    method: "GET",
    path: "/api/imported-files/:id",
    summary: "Fetch a single owned imported-file archive record.",
  },
  {
    resource: "imported-file",
    method: "DELETE",
    path: "/api/imported-files/:id",
    summary: "Delete an owned imported-file archive record.",
  },
  {
    resource: "resume-document",
    method: "POST",
    path: "/api/resume-documents/text",
    summary: "Create a resume document from pasted plain text or markdown content.",
  },
  {
    resource: "resume-document",
    method: "POST",
    path: "/api/resume-documents/file",
    summary: "Upload a txt or markdown resume file, persist its parsed text, and create a resume document.",
  },
  {
    resource: "resume-document",
    method: "GET",
    path: "/api/resume-documents",
    summary: "List owned resume documents with offset pagination ordered by most recently updated first.",
  },
  {
    resource: "resume-document",
    method: "GET",
    path: "/api/resume-documents/:id",
    summary: "Fetch a single owned resume document.",
  },
  {
    resource: "resume-document",
    method: "PATCH",
    path: "/api/resume-documents/:id",
    summary: "Rename a resume document and optionally toggle whether it is the primary resume.",
  },
  {
    resource: "resume-document",
    method: "DELETE",
    path: "/api/resume-documents/:id",
    summary: "Delete an owned resume document and remove its imported file metadata when nothing else references it.",
  },
  {
    resource: "project",
    method: "POST",
    path: "/api/projects",
    summary: "Create or update a resume-relevant project profile.",
  },
  {
    resource: "resume-material",
    method: "POST",
    path: "/api/resume-materials",
    summary: "Create a candidate or confirmed resume-material record without generating a project.",
  },
  {
    resource: "resume-material-extraction",
    method: "POST",
    path: "/api/resume-materials/extract-candidates",
    summary:
      "Deterministically extract candidate resume materials from confirmed ability evidence, projects, resume documents, and structured daily entries with basic de-duplication.",
  },
  {
    resource: "resume-material",
    method: "GET",
    path: "/api/resume-materials",
    summary: "List owned resume-material records with optional status and source-type filters.",
  },
  {
    resource: "resume-material",
    method: "GET",
    path: "/api/resume-materials/:id",
    summary: "Fetch a single owned resume-material record.",
  },
  {
    resource: "resume-material-review",
    method: "PATCH",
    path: "/api/resume-materials/:id/review",
    summary: "Confirm or reject a resume-material candidate while editing its content, bullet, or material type.",
  },
  {
    resource: "resume-material",
    method: "DELETE",
    path: "/api/resume-materials/:id",
    summary: "Permanently delete an owned resume-material record.",
  },
  {
    resource: "resume-gap-analysis",
    method: "POST",
    path: "/api/resume-gap-analysis",
    summary:
      "Run a deterministic, non-persistent first-pass gap analysis between a target role/JD and confirmed resume materials, projects, ability evidence, resume documents, and external sources.",
  },
  {
    resource: "project-packaging-suggestions",
    method: "POST",
    path: "/api/project-packaging-suggestions",
    summary:
      "Generate deterministic, non-persistent first-pass project packaging suggestions using confirmed resume materials, confirmed ability evidence, and optional project scope.",
  },
  {
    resource: "external-source",
    method: "POST",
    path: "/api/external-sources",
    summary: "Save a sourced external research item related to a decision.",
  },
];
