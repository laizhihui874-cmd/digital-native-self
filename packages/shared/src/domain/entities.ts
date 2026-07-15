import type {
  AbilityEvidenceImpact,
  AbilityNodeOrigin,
  AiMessageRole,
  AiMessageStatus,
  CandidateRecordStatus,
  ChangeActorType,
  CitationSourceType,
  DailyEntrySource,
  DecisionEvidenceType,
  EventType,
  EventRecordStatus,
  EventSourceRole,
  EventTimePrecision,
  EvidenceArtifactType,
  EvidencePrivacyLevel,
  EvidenceRevisionType,
  ImportedFileParseStatus,
  ImportedFileSourceType,
  ImportedFileType,
  LifeDecisionStatus,
  MemoryStatus,
  MemoryType,
  MetricType,
  ProjectStatus,
  ProposalOrigin,
  ProposalType,
  ResumeMaterialSourceType,
  ResumeMaterialStatus,
  ResumeMaterialType,
  ResumeDocumentSource,
  ToolCallStatus,
} from "./enums";

export type EntityId = string;
export type IsoDateString = string;

export type StructuredTextItem = {
  title?: string;
  detail: string;
  citationIds?: EntityId[];
};

export type MetricRatingValue = {
  metricType: MetricType;
  aiScore?: number | null;
  userScore?: number | null;
  finalScore?: number | null;
  aiReason?: string | null;
  confirmedByUser: boolean;
};

export type SourceCitation = {
  id: EntityId;
  userId?: EntityId | null;
  sourceType: CitationSourceType;
  sourceId: EntityId;
  sourceVersionId?: EntityId | null;
  contentHash?: string | null;
  title?: string | null;
  url?: string | null;
  excerpt?: string | null;
  locator?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: IsoDateString;
};

export type AiConversation = {
  id: EntityId;
  userId: EntityId;
  title: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type AiMessage = {
  id: EntityId;
  conversationId: EntityId;
  role: AiMessageRole;
  content: string;
  model?: string | null;
  status: AiMessageStatus;
  errorMessage?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  latencyMs?: number | null;
  sourceCount?: number | null;
  sentCharacterCount?: number | null;
  citationCheckPassed?: boolean | null;
  createdAt: IsoDateString;
};

export type Proposal = {
  id: EntityId;
  userId: EntityId;
  proposalType: ProposalType;
  status: CandidateRecordStatus;
  title: string;
  summary?: string | null;
  payload: Record<string, unknown>;
  evidenceFragmentId?: EntityId | null;
  confidence?: number | null;
  origin: ProposalOrigin;
  reviewedAt?: IsoDateString | null;
  appliedEntityType?: string | null;
  appliedEntityId?: EntityId | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type ProposalReview = {
  id: EntityId;
  proposalId: EntityId;
  fromStatus: CandidateRecordStatus;
  toStatus: CandidateRecordStatus;
  actor: ChangeActorType;
  snapshot: Record<string, unknown>;
  note?: string | null;
  createdAt: IsoDateString;
};

export type DailyEntry = {
  id: EntityId;
  userId: EntityId;
  source: DailyEntrySource;
  rawContent: string;
  recordedAt?: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type StructuredDailyReport = {
  id: EntityId;
  dailyEntryId: EntityId;
  facts: StructuredTextItem[];
  emotions: StructuredTextItem[];
  workItems: StructuredTextItem[];
  feedback: StructuredTextItem[];
  growthEvidence: StructuredTextItem[];
  drainSources: StructuredTextItem[];
  nextActions: StructuredTextItem[];
  decisionImpact: StructuredTextItem[];
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type Event = {
  id: EntityId;
  userId: EntityId;
  dailyEntryId?: EntityId | null;
  title: string;
  description?: string | null;
  eventType: EventType;
  occurredAt: IsoDateString;
  endedAt?: IsoDateString | null;
  timePrecision: EventTimePrecision;
  recordStatus: EventRecordStatus;
  primarySourceCitationId?: EntityId | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type EvidenceArtifact = {
  id: EntityId;
  userId: EntityId;
  artifactType: EvidenceArtifactType;
  title?: string | null;
  originalUri?: string | null;
  mimeType?: string | null;
  privacyLevel: EvidencePrivacyLevel;
  capturedAt?: IsoDateString | null;
  createdAt: IsoDateString;
};

export type EvidenceRevision = {
  id: EntityId;
  artifactId: EntityId;
  revisionNumber: number;
  revisionType: EvidenceRevisionType;
  contentHash: string;
  content?: string | null;
  storagePath?: string | null;
  parserVersion?: string | null;
  createdAt: IsoDateString;
};

export type EvidenceFragment = {
  id: EntityId;
  revisionId: EntityId;
  fragmentIndex: number;
  content: string;
  startOffset?: number | null;
  endOffset?: number | null;
  locator?: Record<string, unknown> | null;
  createdAt: IsoDateString;
};

export type EventCandidate = {
  id: EntityId;
  userId: EntityId;
  evidenceFragmentId: EntityId;
  title: string;
  description?: string | null;
  eventType: EventType;
  occurredAt: IsoDateString;
  timePrecision: EventTimePrecision;
  status: CandidateRecordStatus;
  confidence?: number | null;
  reviewedAt?: IsoDateString | null;
  confirmedEventId?: EntityId | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type EventRevision = {
  id: EntityId;
  eventId: EntityId;
  revisionNumber: number;
  title: string;
  description?: string | null;
  eventType: EventType;
  occurredAt: IsoDateString;
  endedAt?: IsoDateString | null;
  timePrecision: EventTimePrecision;
  recordStatus: EventRecordStatus;
  changeReason?: string | null;
  changedBy: ChangeActorType;
  createdAt: IsoDateString;
};

export type EventSource = {
  eventId: EntityId;
  evidenceFragmentId: EntityId;
  role: EventSourceRole;
  createdAt: IsoDateString;
};

export type Memory = {
  id: EntityId;
  userId: EntityId;
  memoryType: MemoryType;
  content: string;
  sourceCitationId?: EntityId | null;
  status: MemoryStatus;
  confidence?: number | null;
  isMomentaryThought: boolean;
  expiresAt?: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type MemoryVersion = {
  id: EntityId;
  memoryId: EntityId;
  previousContent: string;
  newContent: string;
  changeReason?: string | null;
  changedBy: ChangeActorType;
  createdAt: IsoDateString;
};

export type MemorySource = {
  memoryId: EntityId;
  evidenceFragmentId: EntityId;
  role: EventSourceRole;
  createdAt: IsoDateString;
};

export type LifeDecision = {
  id: EntityId;
  userId: EntityId;
  title: string;
  description?: string | null;
  deadline?: IsoDateString | null;
  status: LifeDecisionStatus;
  finalDecision?: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type DecisionPath = {
  id: EntityId;
  decisionId: EntityId;
  title: string;
  description?: string | null;
  benefits: string[];
  risks: string[];
  currentScore?: number | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type DecisionEvidence = {
  id: EntityId;
  decisionId: EntityId;
  pathId: EntityId;
  evidenceType: DecisionEvidenceType;
  content: string;
  sourceCitationId?: EntityId | null;
  weight?: number | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type AbilityNode = {
  id: EntityId;
  userId: EntityId;
  parentId?: EntityId | null;
  name: string;
  description?: string | null;
  level: number;
  origin: AbilityNodeOrigin;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type AbilityEvidence = {
  id: EntityId;
  userId: EntityId;
  abilityNodeId: EntityId;
  sourceCitationId?: EntityId | null;
  content: string;
  impact: AbilityEvidenceImpact;
  difficultyScore: number;
  independenceScore: number;
  impactScore: number;
  feedbackScore: number;
  recurrenceCount: number;
  status: CandidateRecordStatus;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type ExternalSource = {
  id: EntityId;
  userId: EntityId;
  lifeDecisionId?: EntityId | null;
  title: string;
  sourceSite: string;
  url: string;
  publishedAt?: IsoDateString | null;
  fetchedAt?: IsoDateString | null;
  summary?: string | null;
  relationToDecision?: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type ImportedFile = {
  id: EntityId;
  userId: EntityId;
  fileName: string;
  fileType: ImportedFileType;
  sourceType: ImportedFileSourceType;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  contentHash?: string | null;
  storagePath?: string | null;
  parsedText?: string | null;
  parseStatus: ImportedFileParseStatus;
  parseError?: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type ResumeDocument = {
  id: EntityId;
  userId: EntityId;
  importedFileId?: EntityId | null;
  source: ResumeDocumentSource;
  title?: string | null;
  content: string;
  isPrimary: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type ResumeMaterial = {
  id: EntityId;
  userId: EntityId;
  sourceType: ResumeMaterialSourceType;
  sourceId?: EntityId | null;
  materialType: ResumeMaterialType;
  content: string;
  suggestedBullet?: string | null;
  status: ResumeMaterialStatus;
  confidence?: number | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type Embedding = {
  id: EntityId;
  sourceType: CitationSourceType;
  sourceId: EntityId;
  chunkIndex: number;
  content: string;
  embeddingModel: string;
  dimensions?: number | null;
  contentHash: string;
  createdAt: IsoDateString;
};

export type Project = {
  id: EntityId;
  userId: EntityId;
  name: string;
  description?: string | null;
  role?: string | null;
  startDate?: IsoDateString | null;
  endDate?: IsoDateString | null;
  status: ProjectStatus;
  outcomes: string[];
  resumeSummary?: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type ToolCallLog = {
  id: EntityId;
  userId?: EntityId | null;
  agentName: string;
  toolName: string;
  inputSummary?: string | null;
  outputSummary?: string | null;
  status: ToolCallStatus;
  latencyMs?: number | null;
  service?: string | null;
  model?: string | null;
  sourceCount?: number | null;
  sentCharacterCount?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  requestId?: string | null;
  errorMessage?: string | null;
  createdAt: IsoDateString;
};

export type WeeklyReview = {
  id: EntityId;
  userId: EntityId;
  lifeDecisionId?: EntityId | null;
  periodStart: IsoDateString;
  periodEnd: IsoDateString;
  progressSummary?: string | null;
  abilityChanges: StructuredTextItem[];
  emotionPatterns: StructuredTextItem[];
  goalDrift?: string | null;
  nextWeekSuggestions: StructuredTextItem[];
  lifePossibilityNotes?: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type EmotionPattern = {
  id: EntityId;
  userId: EntityId;
  weeklyReviewId?: EntityId | null;
  periodStart: IsoDateString;
  periodEnd: IsoDateString;
  dominantEmotions: string[];
  triggers: string[];
  patterns: StructuredTextItem[];
  decisionRisk?: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};
