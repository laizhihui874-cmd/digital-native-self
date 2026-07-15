import type {
  AbilityEvidence,
  AbilityNode,
  AiConversation,
  AiMessage,
  DailyEntry,
  DecisionEvidence,
  DecisionPath,
  EmotionPattern,
  EntityId,
  Event,
  EventCandidate,
  EventRevision,
  EventSource,
  EvidenceArtifact,
  EvidenceFragment,
  EvidenceRevision,
  ExternalSource,
  ImportedFile,
  IsoDateString,
  LifeDecision,
  Memory,
  MemorySource,
  MemoryVersion,
  MetricRatingValue,
  Project,
  Proposal,
  ProposalReview,
  ResumeMaterial,
  ResumeDocument,
  SourceCitation,
  StructuredDailyReport,
  StructuredTextItem,
  WeeklyReview,
} from "../domain/entities";
import type { PaginatedData } from "../domain/api-response";
import type {
  ActionItemStatus,
  AbilityEvidenceImpact,
  CandidateRecordStatus,
  FuturePlanStatus,
  GoalStatus,
  MilestoneStatus,
  DailyEntrySource,
  DecisionEvidenceType,
  EvidencePrivacyLevel,
  EventRecordStatus,
  EventTimePrecision,
  ImportedFileSourceType,
  ImportedFileType,
  LifeDecisionStatus,
  MemoryStatus,
  MemoryType,
  ProjectStatus,
  ProposalType,
  ResumeMaterialSourceType,
  ResumeMaterialStatus,
  ResumeMaterialType,
} from "../domain/enums";

export const apiRoutes = {
  dailyEntries: "/api/daily-entries",
  dailyEntryStructuredReportDraft: "/api/daily-entries/:dailyEntryId/structured-report-draft",
  dailyEntryStructuredReportGenerate: "/api/daily-entries/:dailyEntryId/structured-report-generate",
  structuredDailyReports: "/api/structured-daily-reports",
  memories: "/api/memories",
  lifeDecisions: "/api/life-decisions",
  decisionEvidence: "/api/decision-evidence",
  abilityNodes: "/api/ability-nodes",
  abilityEvidence: "/api/ability-evidence",
  weeklyReviews: "/api/weekly-reviews",
  importedFiles: "/api/imported-files",
  resumeDocuments: "/api/resume-documents",
  resumeMaterials: "/api/resume-materials",
  resumeMaterialExtractCandidates: "/api/resume-materials/extract-candidates",
  resumeGapAnalysis: "/api/resume-gap-analysis",
  projectPackagingSuggestions: "/api/project-packaging-suggestions",
  projects: "/api/projects",
  externalSources: "/api/external-sources",
  externalSourceSearch: "/api/external-sources/search",
  externalSourceImpactDraft: "/api/external-sources/impact-draft",
  toolCallLogs: "/api/tool-call-logs",
  lifeGraphSubgraph: "/api/life-graph/subgraph",
  evidenceArtifacts: "/api/evidence/artifacts",
  eventCandidates: "/api/event-candidates",
  events: "/api/events",
  dataControlOverview: "/api/data-control",
  archiveExport: "/api/data-control/archive-export",
  archiveExportBundle: "/api/data-control/archive-export.zip",
  archiveRestorePreview: "/api/data-control/restore-preview",
  deleteAiData: "/api/data-control/ai-data",
  graphRelations: "/api/graph-relations",
  people: "/api/people",
  archiveSearch: "/api/archive-search",
  aiSettings: "/api/ai/settings",
  aiSettingsTest: "/api/ai/settings/test",
  aiConversations: "/api/ai/conversations",
  reviewItems: "/api/review-items",
} as const;

export type ExternalProcessingCapability = {
  id:
    | "file_parsing"
    | "memory_search"
    | "archive_search"
    | "archive_assistant"
    | "structured_report_model"
    | "external_web_search";
  label: string;
  processingLocation: "local" | "external";
  provider: string;
  enabled: boolean;
  sendsPersonalContent: boolean;
  description: string;
};

export type DataControlOverview = {
  accessMode: "local_loopback_only";
  externalProcessingExplicitlyAllowed: boolean;
  capabilities: ExternalProcessingCapability[];
};

export type ArchiveExport = {
  schemaVersion: "digital-self-archive/v1";
  exportedAt: IsoDateString;
  user: { id: string; displayName: string | null; timezone: string | null };
  files: {
    rawFilesIncluded: boolean;
    note: string;
    manifest?: ArchiveFileManifestEntry[];
  };
  counts: Record<string, number>;
  collections: Record<string, unknown[]>;
};

export type ArchiveFileManifestEntry = {
  archivePath: string;
  artifactId: EntityId;
  revisionId: EntityId;
  sha256: string;
  size: number;
};

export type ArchiveRestoreMode = "replace_all" | "merge_skip";

export type ArchiveRestoreRequest = {
  mode: ArchiveRestoreMode;
  confirmationText?: string;
};

export type ArchiveRestoreResult = {
  mode: ArchiveRestoreMode;
  imported: number;
  skipped: number;
  replaced: number;
  filesRestored: number;
  missingFiles: string[];
  failed: number;
  backupPath?: string;
  collections: Record<string, { imported: number; skipped: number }>;
};

export type ArchiveRestoreConflict = {
  collection: string;
  id: string;
  reason: "id_exists";
};

export type ArchiveRestorePreview = {
  schemaVersion: string;
  supported: boolean;
  exportedAt?: IsoDateString;
  archiveUserId?: string;
  collectionCounts: Record<string, number>;
  totalRecords: number;
  bundleFileCount: number;
  missingFiles: string[];
  conflicts: ArchiveRestoreConflict[];
  conflictCount: number;
  warnings: string[];
  currentDatabase: {
    hasExistingData: boolean;
    recordCount: number;
  };
  canRestoreToEmptyDatabase: boolean;
};

export type DeleteAiDataRequest = {
  conversations?: boolean;
  callLogs?: boolean;
  settings?: boolean;
};

export type DeleteAiDataResponse = {
  conversationsDeleted: number;
  messagesDeleted: number;
  citationUsesDeleted: number;
  callLogsDeleted: number;
  settingsDeleted: number;
};

export type CreateTextEvidenceArtifactRequest = {
  title?: string;
  content: string;
  capturedAt?: IsoDateString;
  privacyLevel?: EvidencePrivacyLevel;
};

export type AppendParsedEvidenceRevisionRequest = {
  content: string;
  parserVersion: string;
};

export type EvidenceArtifactDetail = EvidenceArtifact & {
  revisions: Array<EvidenceRevision & { fragments: EvidenceFragment[] }>;
};

export type ListEvidenceArtifactsQuery = ListQuery;
export type ListEvidenceArtifactsResponse = PaginatedData<EvidenceArtifact>;

export type CreateEventCandidateRequest = {
  evidenceFragmentId: EntityId;
  title: string;
  description?: string;
  eventType: Event["eventType"];
  occurredAt: IsoDateString;
  timePrecision?: EventTimePrecision;
  confidence?: number;
};

export type CreateMemoryCandidateFromEventRequest = {
  content: string;
  memoryType: "ability" | "value" | "relationship" | "recurring_problem";
  confidence?: number;
};

export type MemoryArchiveDetail = Memory & {
  versions: MemoryVersion[];
  evidenceSources: Array<
    MemorySource & {
      evidenceFragment: EvidenceFragment & {
        revision: EvidenceRevision & { artifact: EvidenceArtifact };
      };
    }
  >;
};

export type ReviewEventCandidateRequest = {
  status: "confirmed" | "rejected";
  title?: string;
  description?: string | null;
  eventType?: Event["eventType"];
  occurredAt?: IsoDateString;
  timePrecision?: EventTimePrecision;
};

export type EventCandidateDetail = EventCandidate & {
  evidenceFragment: EvidenceFragment & {
    revision: EvidenceRevision & { artifact: EvidenceArtifact };
  };
  confirmedEvent?: EventDetail | null;
};

export type ListEventCandidatesQuery = ListQuery & {
  status?: "candidate" | "confirmed" | "rejected";
};
export type ListEventCandidatesResponse = PaginatedData<EventCandidateDetail>;

export type EventProposalPayload = {
  eventType: Event["eventType"];
  occurredAt: IsoDateString;
  timePrecision: EventTimePrecision;
  description?: string | null;
};

export type ProposalDetail = Proposal & {
  evidenceFragment?: EventCandidateDetail["evidenceFragment"] | null;
  reviews: ProposalReview[];
};

export type ReviewItemKind = "proposal" | "memory" | "ability_evidence";
export type ReviewItem = {
  kind: ReviewItemKind;
  id: EntityId;
  proposalType?: ProposalType;
  title: string;
  content: string;
  status: CandidateRecordStatus | Extract<MemoryStatus, "candidate" | "confirmed" | "rejected" | "expired">;
  confidence?: number | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  source?: {
    type: string;
    title: string;
    excerpt?: string | null;
    path: string;
  } | null;
  metadata: Record<string, string | number | boolean | null>;
  duplicateGroupId?: string;
  duplicateCount?: number;
};

export type ListReviewItemsQuery = ListQuery & {
  kind?: ReviewItemKind;
  status?: "candidate" | "confirmed" | "rejected";
  query?: string;
  sourceType?: string;
  dateFrom?: IsoDateString;
  dateTo?: IsoDateString;
  minConfidence?: number;
  sort?: "newest" | "oldest" | "confidence_desc" | "confidence_asc";
};
export type ListReviewItemsResponse = PaginatedData<ReviewItem> & {
  counts: Record<ReviewItemKind, number>;
  globalPendingCount: number;
  filteredCount: number;
};

export type ReviewReviewItemRequest = {
  status: "confirmed" | "rejected";
  title?: string;
  content?: string;
  note?: string;
};

export type BulkReviewItemInput = {
  kind: ReviewItemKind;
  id: EntityId;
  title?: string;
  content?: string;
};

export type BulkReviewItemsRequest = {
  status: "confirmed" | "rejected";
  items: BulkReviewItemInput[];
  note?: string;
};

export type BulkReviewItemResult = {
  kind: ReviewItemKind;
  id: EntityId;
  ok: boolean;
  item?: ReviewItem;
  error?: string;
};

export type BulkReviewItemsResponse = {
  results: BulkReviewItemResult[];
  summary: { requested: number; succeeded: number; failed: number };
};

export type EventDetail = Event & {
  revisions: EventRevision[];
  sources: Array<
    EventSource & {
      evidenceFragment: EvidenceFragment & {
        revision: EvidenceRevision & { artifact: EvidenceArtifact };
      };
    }
  >;
  participants: EventParticipant[];
};

export type ListEventsQuery = ListQuery;
export type ListEventsResponse = PaginatedData<EventDetail>;

export type UpdateEventRequest = {
  title?: string;
  description?: string | null;
  eventType?: Event["eventType"];
  occurredAt?: IsoDateString;
  endedAt?: IsoDateString | null;
  timePrecision?: EventTimePrecision;
  recordStatus?: EventRecordStatus;
  changeReason?: string;
};

export type ListQuery = {
  limit?: number;
  offset?: number;
  from?: IsoDateString;
  to?: IsoDateString;
};

export const lifeGraphNodeTypeValues = [
  "event",
  "memory",
  "project",
  "ability",
  "decision",
  "person",
  "goal",
  "plan",
  "milestone",
  "action",
] as const;

export type LifeGraphNodeType = (typeof lifeGraphNodeTypeValues)[number];

export type LifeGraphReviewState = "confirmed" | "candidate" | "not_required";

export type LifeGraphRelationType =
  | "formed_memory"
  | "demonstrates_ability"
  | "project_uses_ability"
  | "influenced_decision"
  | "ability_parent"
  | "participated_in_event"
  | "goal_has_plan"
  | "plan_has_milestone"
  | "plan_has_action"
  | "milestone_has_action"
  | "manual_relation";

export type LifeGraphSource = {
  citationId: EntityId;
  sourceType: string;
  sourceId: string;
  title?: string;
  excerpt?: string;
  locator?: string;
};

export type LifeGraphNode = {
  id: string;
  entityId: EntityId;
  nodeType: LifeGraphNodeType;
  title: string;
  summary?: string;
  occurredAt?: IsoDateString;
  createdAt: IsoDateString;
  status: string;
  reviewState: LifeGraphReviewState;
  importance: number;
  source?: LifeGraphSource;
};

export type LifeGraphEdge = {
  id: string;
  source: string;
  target: string;
  relationType: LifeGraphRelationType;
  label: string;
  reviewState: LifeGraphReviewState;
  provenance: "source_citation" | "evidence_fragment" | "database_relation" | "manual_relation";
  citationId?: EntityId;
  graphRelationId?: EntityId;
  eventParticipantId?: EntityId;
};

export type LifeGraphSubgraphQuery = {
  centerId?: string;
  depth?: 1 | 2 | 3;
  from?: IsoDateString;
  to?: IsoDateString;
  asOf?: IsoDateString;
  nodeTypes?: LifeGraphNodeType[];
  statuses?: string[];
  limit?: number;
};

export type LifeGraphSubgraphResponse = {
  nodes: LifeGraphNode[];
  edges: LifeGraphEdge[];
  summary: {
    nodeCount: number;
    edgeCount: number;
    countsByType: Partial<Record<LifeGraphNodeType, number>>;
    truncated: boolean;
  };
  availableRange: {
    from?: IsoDateString;
    to?: IsoDateString;
  };
  filters: {
    centerId?: string;
    depth: 1 | 2 | 3;
    from?: IsoDateString;
    to?: IsoDateString;
    asOf?: IsoDateString;
    nodeTypes: LifeGraphNodeType[];
    statuses: string[];
    limit: number;
  };
};

export type GraphRelation = {
  id: EntityId;
  sourceType: LifeGraphNodeType;
  sourceId: EntityId;
  targetType: LifeGraphNodeType;
  targetId: EntityId;
  relationType: string;
  label: string;
  status: "candidate" | "confirmed" | "rejected";
  validFrom?: IsoDateString;
  validTo?: IsoDateString;
  evidenceFragmentId?: EntityId;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type CreateGraphRelationRequest = {
  sourceType: LifeGraphNodeType;
  sourceId: EntityId;
  targetType: LifeGraphNodeType;
  targetId: EntityId;
  relationType: string;
  label: string;
  status?: "candidate" | "confirmed";
  validFrom?: IsoDateString;
  validTo?: IsoDateString;
  evidenceFragmentId?: EntityId;
};

export type UpdateGraphRelationRequest = {
  relationType?: string;
  label?: string;
  status?: "candidate" | "confirmed" | "rejected";
  validFrom?: IsoDateString;
  validTo?: IsoDateString;
  evidenceFragmentId?: EntityId;
};

export type Person = {
  id: EntityId;
  name: string;
  relationship?: string;
  description?: string;
  firstMetAt?: IsoDateString;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type CreatePersonRequest = {
  name: string;
  relationship?: string;
  description?: string;
  firstMetAt?: IsoDateString;
};

export type UpdatePersonRequest = Partial<CreatePersonRequest>;

export type EventParticipant = {
  id: EntityId;
  eventId: EntityId;
  personId: EntityId;
  role?: string;
  description?: string;
  evidenceFragmentId?: EntityId;
  validFrom?: IsoDateString;
  validTo?: IsoDateString;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type CreateEventParticipantRequest = {
  personId: EntityId;
  role?: string;
  description?: string;
  evidenceFragmentId?: EntityId;
  validFrom?: IsoDateString;
  validTo?: IsoDateString;
};

export type UpdateEventParticipantRequest = Omit<Partial<CreateEventParticipantRequest>, "personId">;

export type Goal = {
  id: EntityId;
  title: string;
  description?: string;
  area?: string;
  successCriteria?: string;
  status: GoalStatus;
  priority: number;
  targetDate?: IsoDateString;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type FuturePlan = {
  id: EntityId;
  goalId: EntityId;
  title: string;
  description?: string;
  status: FuturePlanStatus;
  startDate?: IsoDateString;
  endDate?: IsoDateString;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type Milestone = {
  id: EntityId;
  planId: EntityId;
  title: string;
  description?: string;
  status: MilestoneStatus;
  dueAt?: IsoDateString;
  completedAt?: IsoDateString;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type ActionItem = {
  id: EntityId;
  planId: EntityId;
  milestoneId?: EntityId;
  title: string;
  description?: string;
  status: ActionItemStatus;
  dueAt?: IsoDateString;
  completedAt?: IsoDateString;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type PlanningTree = Array<Goal & {
  plans: Array<FuturePlan & {
    milestones: Milestone[];
    actionItems: ActionItem[];
  }>;
}>;

export type CreateGoalRequest = Pick<Goal, "title"> & Partial<Pick<Goal, "description" | "area" | "successCriteria" | "status" | "priority" | "targetDate">>;
export type UpdateGoalRequest = Partial<CreateGoalRequest>;
export type CreateFuturePlanRequest = Pick<FuturePlan, "title"> & Partial<Pick<FuturePlan, "description" | "status" | "startDate" | "endDate">>;
export type UpdateFuturePlanRequest = Partial<CreateFuturePlanRequest>;
export type CreateMilestoneRequest = Pick<Milestone, "title"> & Partial<Pick<Milestone, "description" | "status" | "dueAt">>;
export type UpdateMilestoneRequest = Partial<CreateMilestoneRequest>;
export type CreateActionItemRequest = Pick<ActionItem, "title"> & Partial<Pick<ActionItem, "description" | "status" | "dueAt" | "milestoneId">>;
export type UpdateActionItemRequest = Partial<CreateActionItemRequest>;

export type CreateDailyEntryRequest = {
  source?: DailyEntrySource;
  rawContent: string;
  recordedAt?: IsoDateString;
};

export type DailyEntryDetail = DailyEntry & {
  structuredReport?: StructuredDailyReport | null;
  metrics: MetricRatingValue[];
  events: Event[];
};

export type ListDailyEntriesResponse = PaginatedData<DailyEntry>;

export type CreateStructuredDailyReportRequest = {
  dailyEntryId: EntityId;
  facts: StructuredTextItem[];
  emotions: StructuredTextItem[];
  workItems: StructuredTextItem[];
  feedback: StructuredTextItem[];
  growthEvidence: StructuredTextItem[];
  drainSources: StructuredTextItem[];
  nextActions: StructuredTextItem[];
  decisionImpact: StructuredTextItem[];
};

export type CreateStructuredDailyReportMemoryCandidatesResponse = {
  source: {
    dailyEntryId: EntityId;
    structuredReportId: EntityId;
  };
  created: Memory[];
  skippedCount: number;
};

export type CreateMemoryRequest = {
  memoryType: MemoryType;
  content: string;
  sourceCitationId?: EntityId;
  status?: Extract<MemoryStatus, "candidate" | "confirmed">;
  confidence?: number;
  isMomentaryThought?: boolean;
  expiresAt?: IsoDateString | null;
};

export type ListMemoriesQuery = ListQuery & {
  status?: MemoryStatus;
  memoryType?: MemoryType;
};

export type ListMemoriesResponse = PaginatedData<Memory>;

export type SearchMemoriesRequest = {
  query: string;
  limit?: number;
};

export type SearchMemoryResult = {
  memory: Memory;
  score: number;
  matchedTerms: string[];
};

export type SearchMemoriesResponse = {
  retrievalMode: "lexical";
  /** @deprecated Embeddings are not produced. This field remains for older clients. */
  embeddingModel: "none";
  query: string;
  items: SearchMemoryResult[];
  sourceSnapshot: {
    confirmedMemoriesRead: number;
    embeddedMemoriesCreatedOrUpdated: number;
  };
  warning: string;
};

export type ArchiveSearchContext = {
  entityType:
    | "event"
    | "memory"
    | "project"
    | "ability"
    | "decision"
    | "person"
    | "goal"
    | "plan"
    | "milestone"
    | "action"
    | "artifact";
  entityId: EntityId;
};

export type ArchiveSearchRequest = {
  query: string;
  limit?: number;
  context?: ArchiveSearchContext;
  allowExpansion?: boolean;
};

export type ArchiveSearchHit = {
  citationId: string;
  sourceType: SourceCitation["sourceType"];
  sourceId: EntityId;
  sourceVersionId?: EntityId;
  title: string;
  excerpt: string;
  locator?: string;
  occurredAt?: IsoDateString;
  status?: string;
  matchedTerms: string[];
  sourcePath: string;
};

export type ArchiveSearchResponse = {
  searchMode: "lexical" | "lexical_expanded";
  normalizedQuery: string;
  expandedTerms: string[];
  hits: ArchiveSearchHit[];
};

export type AiSettings = {
  baseUrl: string;
  fastModel: string;
  analysisModel: string;
  enabled: boolean;
  externalProcessingConsentAt?: IsoDateString | null;
  hasCredential: boolean;
  credentialSource: "keychain" | "environment" | "none";
};

export type UpdateAiSettingsRequest = {
  baseUrl: string;
  fastModel: string;
  analysisModel: string;
  enabled: boolean;
  externalProcessingConsent: boolean;
  apiKey?: string;
  removeCredential?: boolean;
};

export type TestAiSettingsResponse = {
  ok: true;
  slot: "fast" | "analysis";
  model: string;
  latencyMs: number;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  result: string;
};

export type TestAiSettingsRequest = { slot?: "fast" | "analysis" };

export type CreateAiConversationRequest = { title?: string };
export type UpdateAiConversationRequest = { title: string };
export type ListAiConversationsResponse = AiConversation[];

export type AiMessageCitation = {
  marker: string;
  citation: SourceCitation;
  sourcePath: string;
};

export type AiMessageWithCitations = AiMessage & {
  citations: AiMessageCitation[];
};

export type CreateAiMessageRequest = {
  content: string;
  context?: ArchiveSearchContext;
  retryUserMessageId?: EntityId;
};

export type AiAssistantStreamEvent =
  | { type: "started"; userMessage: AiMessage; reused?: boolean }
  | { type: "retrieval"; search: ArchiveSearchResponse; sentSourceCount: number; sentCharacterCount: number; model: string }
  | { type: "delta"; text: string }
  | { type: "completed"; message: AiMessageWithCitations; citationCheckPassed: boolean }
  | { type: "error"; message: string; code?: string };

export type ReviewMemoryRequest = {
  content?: string;
  memoryType?: MemoryType;
  status: Extract<MemoryStatus, "confirmed" | "rejected" | "expired">;
  expiresAt?: IsoDateString | null;
  isMomentaryThought?: boolean;
  changeReason?: string;
};

export type CreateLifeDecisionRequest = {
  title: string;
  description?: string;
  deadline?: IsoDateString;
  status?: LifeDecisionStatus;
};

export type CreateDecisionPathRequest = {
  decisionId: EntityId;
  title: string;
  description?: string;
  benefits?: string[];
  risks?: string[];
  currentScore?: number;
};

export type CreateDecisionEvidenceRequest = {
  decisionId: EntityId;
  pathId: EntityId;
  evidenceType: DecisionEvidenceType;
  content: string;
  sourceCitationId?: EntityId;
  externalSourceId?: EntityId;
  weight?: number;
};

export type ListDecisionEvidenceQuery = ListQuery & {
  decisionId?: EntityId;
  pathId?: EntityId;
};

export type ListDecisionEvidenceResponse = PaginatedData<DecisionEvidence>;

export type UpdateDecisionEvidenceRequest = {
  evidenceType?: DecisionEvidenceType;
  content?: string;
  weight?: number | null;
};

export type LifeDecisionDetail = LifeDecision & {
  paths: Array<
    DecisionPath & {
      evidenceItems: DecisionEvidence[];
    }
  >;
  externalSources: ExternalSource[];
};

export type CreateAbilityNodeRequest = {
  name: string;
  description?: string;
  parentId?: EntityId | null;
};

export type UpdateAbilityNodeRequest = {
  name?: string;
  description?: string | null;
  parentId?: EntityId | null;
};

export type ListAbilityNodesResponse = {
  items: AbilityNodeDetail[];
};

export type CreateAbilityEvidenceRequest = {
  abilityNodeId: EntityId;
  sourceCitationId?: EntityId;
  content: string;
  impact: AbilityEvidenceImpact;
  difficultyScore: number;
  independenceScore: number;
  impactScore: number;
  feedbackScore: number;
  recurrenceCount?: number;
  status?: CandidateRecordStatus;
};

export type AbilityNodeDetail = AbilityNode & {
  evidenceItems: AbilityEvidence[];
  children: AbilityNodeDetail[];
};

export type ListAbilityEvidenceQuery = ListQuery & {
  abilityNodeId?: EntityId;
  status?: CandidateRecordStatus;
};

export type ListAbilityEvidenceResponse = PaginatedData<AbilityEvidence>;

export type ReviewAbilityEvidenceRequest = {
  status: Extract<CandidateRecordStatus, "confirmed" | "rejected">;
  content?: string;
  impact?: AbilityEvidenceImpact;
  difficultyScore?: number;
  independenceScore?: number;
  impactScore?: number;
  feedbackScore?: number;
  recurrenceCount?: number;
};

export type CreateMetricRatingRequest = {
  dailyEntryId: EntityId;
  metricType: MetricRatingValue["metricType"];
  aiScore?: number;
  userScore?: number;
  finalScore?: number;
  aiReason?: string;
  confirmedByUser?: boolean;
};

export type CreateExternalSourceRequest = {
  lifeDecisionId?: EntityId;
  title: string;
  sourceSite: string;
  url: string;
  publishedAt?: IsoDateString;
  summary?: string;
  relationToDecision?: string;
};

export type UpdateExternalSourceRequest = {
  lifeDecisionId?: EntityId | null;
  title?: string;
  sourceSite?: string;
  url?: string;
  publishedAt?: IsoDateString | null;
  summary?: string | null;
  relationToDecision?: string | null;
};

export type ListExternalSourcesQuery = {
  lifeDecisionId?: EntityId;
  limit?: number;
  offset?: number;
};

export type ListExternalSourcesResponse = PaginatedData<ExternalSource>;

export type ExternalSourceSearchCategory =
  | "ai_role"
  | "job_market"
  | "industry"
  | "postgraduate"
  | "other";

export type SearchExternalSourcesRequest = {
  query: string;
  category?: ExternalSourceSearchCategory;
  lifeDecisionId?: EntityId;
  limit?: number;
};

export type SearchExternalSourceItem = {
  title: string;
  sourceSite: string;
  url: string;
  publishedAt?: IsoDateString | null;
  summary?: string | null;
  relationToDecision?: string | null;
};

export type SearchExternalSourcesResponse = {
  query: string;
  category: ExternalSourceSearchCategory;
  searchMode: "fake" | "best_effort_web";
  summary: string;
  items: SearchExternalSourceItem[];
  savedItems: ExternalSource[];
  sourceSnapshot: {
    searchedAt: IsoDateString;
    provider: string;
    requestedLimit: number;
    returnedResults: number;
    savedResults: number;
    lifeDecisionId?: EntityId | null;
  };
};

export type CreateExternalSourceImpactDraftRequest = {
  lifeDecisionId: EntityId;
  externalSourceIds?: EntityId[];
  maxItems?: number;
};

export type ExternalSourceImpactDraftItem = {
  externalSourceId: EntityId;
  externalSourceTitle: string;
  sourceSite: string;
  url: string;
  pathId: EntityId;
  pathTitle: string;
  evidenceType: DecisionEvidenceType;
  suggestedWeight: number;
  suggestedContent: string;
  rationale: string;
  confirmationRequired: true;
};

export type ExternalSourceImpactDraftResponse = {
  analysisMode: "deterministic";
  lifeDecisionId: EntityId;
  generatedAt: IsoDateString;
  items: ExternalSourceImpactDraftItem[];
  warnings: string[];
  sourceSnapshot: {
    externalSourcesRead: number;
    pathsRead: number;
    selectedSourceIds: EntityId[];
  };
};

export type RegisterImportedFileRequest = {
  fileName: string;
  fileType: ImportedFileType;
  sourceType: ImportedFileSourceType;
  mimeType?: string;
  fileSizeBytes?: number;
  contentHash?: string;
  storagePath?: string;
  parsedText?: string;
  parseStatus?: "pending" | "succeeded" | "failed";
  parseError?: string;
};

export type CreateImportedFileTextRequest = {
  fileName?: string;
  fileType?: Extract<ImportedFileType, "txt" | "markdown">;
  content: string;
};

export type ListImportedFilesQuery = ListQuery & {
  sourceType?: ImportedFileSourceType;
};

export type ListImportedFilesResponse = PaginatedData<ImportedFile>;

export type CreateResumeDocumentTextRequest = {
  title?: string;
  content: string;
  isPrimary?: boolean;
};

export type CreateResumeDocumentFileRequest = {
  title?: string;
  isPrimary?: boolean;
};

export type UpdateResumeDocumentRequest = {
  title?: string | null;
  isPrimary?: boolean;
};

export type ListResumeDocumentsQuery = ListQuery;

export type ListResumeDocumentsResponse = PaginatedData<ResumeDocument>;

export type CreateResumeMaterialRequest = {
  sourceType?: ResumeMaterialSourceType;
  sourceId?: EntityId | null;
  materialType?: ResumeMaterialType;
  content: string;
  suggestedBullet?: string | null;
  status?: Extract<ResumeMaterialStatus, "candidate" | "confirmed">;
  confidence?: number | null;
};

export type ExtractResumeMaterialCandidatesRequest = {
  limitPerSource?: number;
};

export type ExtractResumeMaterialCandidatesResponse = {
  created: ResumeMaterial[];
  skippedCount: number;
  scanned: {
    abilityEvidence: number;
    projects: number;
    resumeDocuments: number;
    dailyEntries: number;
  };
};

export type ListResumeMaterialsQuery = ListQuery & {
  status?: ResumeMaterialStatus;
  sourceType?: ResumeMaterialSourceType;
};

export type ListResumeMaterialsResponse = PaginatedData<ResumeMaterial>;

export type ReviewResumeMaterialRequest = {
  status: Extract<ResumeMaterialStatus, "confirmed" | "rejected">;
  content?: string;
  suggestedBullet?: string | null;
  materialType?: ResumeMaterialType;
};

export type CreateResumeGapAnalysisRequest = {
  targetRole: string;
  targetJobDescription?: string;
  targetCompany?: string;
};

export type ResumeGapRequirementItem = {
  id: string;
  text: string;
  keywords: string[];
  source: "jd" | "role_template";
};

export type ResumeGapMatchedEvidence = {
  requirementId: string;
  requirementText: string;
  evidenceType:
    | "resume_document"
    | "resume_material"
    | "project"
    | "ability_evidence"
    | "external_source";
  evidenceId: EntityId;
  title?: string | null;
  content: string;
  matchedKeywords: string[];
};

export type ResumeGapItem = {
  requirementId: string;
  requirementText: string;
  severity: "high" | "medium" | "low";
  reason: string;
  missingKeywords: string[];
};

export type ResumeGapAnalysisResponse = {
  targetRole: string;
  targetCompany?: string | null;
  summary: string;
  analysisMode: "deterministic";
  requirementItems: ResumeGapRequirementItem[];
  matchedEvidence: ResumeGapMatchedEvidence[];
  gapItems: ResumeGapItem[];
  actionSuggestions: string[];
  sourceSnapshot: {
    resumeDocuments: number;
    confirmedResumeMaterials: number;
    projects: number;
    confirmedAbilityEvidence: number;
    externalSources: number;
  };
};

export type CreateProjectPackagingSuggestionsRequest = {
  targetRole: string;
  targetJobDescription?: string;
  targetCompany?: string;
  projectId?: EntityId;
};

export type ProjectPackagingSuggestionEvidenceItem = {
  evidenceType: "project" | "resume_material" | "ability_evidence";
  evidenceId: EntityId;
  title?: string | null;
  content: string;
};

export type ProjectPackagingSuggestionItem = {
  id: string;
  category:
    | "project_title"
    | "resume_star"
    | "quantified_outcome"
    | "ability_mapping"
    | "gap_alert";
  label: string;
  suggestion: string;
  rationale: string;
  evidenceItems: ProjectPackagingSuggestionEvidenceItem[];
};

export type ProjectPackagingSuggestionsResponse = {
  targetRole: string;
  targetCompany?: string | null;
  targetJobDescription?: string | null;
  projectId?: EntityId | null;
  analysisMode: "deterministic";
  summary: string;
  suggestionItems: ProjectPackagingSuggestionItem[];
  evidenceSnapshot: {
    selectedProject?: {
      id: EntityId;
      name: string;
      role?: string | null;
      resumeSummary?: string | null;
      outcomes: string[];
    } | null;
    confirmedResumeMaterials: Array<{
      id: EntityId;
      materialType: string;
      content: string;
      suggestedBullet?: string | null;
    }>;
    confirmedAbilityEvidence: Array<{
      id: EntityId;
      abilityName: string;
      content: string;
    }>;
  };
  sourceSnapshot: {
    confirmedResumeMaterials: number;
    confirmedAbilityEvidence: number;
    availableProjects: number;
    scopedToProjectId?: EntityId | null;
  };
};

export type CreateProjectRequest = {
  name: string;
  description?: string;
  role?: string;
  startDate?: IsoDateString;
  endDate?: IsoDateString;
  status?: ProjectStatus;
  outcomes?: string[];
  resumeSummary?: string;
  abilityEvidenceIds?: EntityId[];
};

export type UpdateProjectRequest = Partial<CreateProjectRequest>;

export type ListProjectsQuery = ListQuery & {
  status?: ProjectStatus;
};

export type ListProjectsResponse = PaginatedData<Project>;

export type ProjectDetail = Project & {
  abilityEvidenceItems: AbilityEvidence[];
};

export type CreateWeeklyReviewRequest = {
  lifeDecisionId?: EntityId;
  periodStart: IsoDateString;
  periodEnd: IsoDateString;
  progressSummary?: string;
  abilityChanges: StructuredTextItem[];
  emotionPatterns: StructuredTextItem[];
  goalDrift?: string;
  nextWeekSuggestions: StructuredTextItem[];
  lifePossibilityNotes?: string;
  emotionPattern?: {
    dominantEmotions: string[];
    triggers: string[];
    patterns: StructuredTextItem[];
    decisionRisk?: string;
  };
};

export type WeeklyReviewGenerateRequest = {
  periodStart: IsoDateString;
  periodEnd: IsoDateString;
  lifeDecisionId?: EntityId;
};

export type WeeklyReviewSourceSnapshot = {
  dailyEntriesRead: number;
  structuredReportsRead: number;
  metricRatingsRead: number;
  confirmedMemoriesRead: number;
  decisionEvidenceRead: number;
};

export type WeeklyReviewGenerateResponse = {
  weeklyReview: WeeklyReviewDetail;
  generationMode: "deterministic";
  sourceSnapshot: WeeklyReviewSourceSnapshot;
};

export type GetLatestWeeklyReviewQuery = {
  lifeDecisionId?: EntityId;
};

export type GetWeeklyReviewByPeriodQuery = {
  periodStart: IsoDateString;
  periodEnd: IsoDateString;
  lifeDecisionId?: EntityId;
};

export type WeeklyReviewDetail = WeeklyReview & {
  emotionPattern?: EmotionPattern | null;
  citations?: SourceCitation[];
};

export type CoreApiEntityMap = {
  dailyEntry: DailyEntryDetail;
  structuredDailyReport: StructuredDailyReport;
  memory: Memory;
  lifeDecision: LifeDecisionDetail;
  abilityNode: AbilityNodeDetail;
  abilityEvidence: AbilityEvidence;
  weeklyReview: WeeklyReviewDetail;
  importedFile: ImportedFile;
  resumeDocument: ResumeDocument;
  resumeMaterial: ResumeMaterial;
  project: ProjectDetail;
  externalSource: ExternalSource;
  sourceCitation: SourceCitation;
};
