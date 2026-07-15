export const dailyEntrySourceValues = ["feishu", "web", "import"] as const;
export type DailyEntrySource = (typeof dailyEntrySourceValues)[number];

export const memoryTypeValues = [
  "goal",
  "ability",
  "value",
  "event",
  "relationship",
  "recurring_problem",
  "decision",
] as const;
export type MemoryType = (typeof memoryTypeValues)[number];

export const memoryStatusValues = [
  "candidate",
  "confirmed",
  "rejected",
  "expired",
] as const;
export type MemoryStatus = (typeof memoryStatusValues)[number];

export const lifeDecisionStatusValues = ["active", "decided", "archived"] as const;
export type LifeDecisionStatus = (typeof lifeDecisionStatusValues)[number];

export const decisionEvidenceTypeValues = ["support", "against", "neutral"] as const;
export type DecisionEvidenceType = (typeof decisionEvidenceTypeValues)[number];

export const abilityNodeOriginValues = ["system", "custom"] as const;
export type AbilityNodeOrigin = (typeof abilityNodeOriginValues)[number];

export const candidateRecordStatusValues = [
  "candidate",
  "confirmed",
  "rejected",
] as const;
export type CandidateRecordStatus = (typeof candidateRecordStatusValues)[number];

export const abilityEvidenceImpactValues = [
  "positive",
  "negative",
  "neutral",
] as const;
export type AbilityEvidenceImpact = (typeof abilityEvidenceImpactValues)[number];

export const metricTypeValues = [
  "growth",
  "emotional_drain",
  "long_term_fit",
  "communication_pressure",
] as const;
export type MetricType = (typeof metricTypeValues)[number];

export const citationSourceTypeValues = [
  "daily_entry",
  "external_link",
  "imported_file",
  "feishu_message",
  "memory",
  "event",
  "project",
  "ability_evidence",
  "life_decision",
  "person",
  "goal",
  "plan",
  "milestone",
  "action",
  "weekly_review",
  "evidence_fragment",
] as const;
export type CitationSourceType = (typeof citationSourceTypeValues)[number];

export const aiMessageRoleValues = ["user", "assistant"] as const;
export type AiMessageRole = (typeof aiMessageRoleValues)[number];

export const aiMessageStatusValues = ["completed", "citation_warning"] as const;
export type AiMessageStatus = (typeof aiMessageStatusValues)[number];

export const citationConsumerTypeValues = ["ai_message", "proposal", "analysis"] as const;
export type CitationConsumerType = (typeof citationConsumerTypeValues)[number];

export const citationUsePurposeValues = ["context", "answer_support", "answer_opposition"] as const;
export type CitationUsePurpose = (typeof citationUsePurposeValues)[number];

export const proposalTypeValues = [
  "event",
  "memory",
  "person",
  "relation",
  "ability_evidence",
  "plan",
  "other",
] as const;
export type ProposalType = (typeof proposalTypeValues)[number];

export const proposalOriginValues = ["manual", "ai", "migration"] as const;
export type ProposalOrigin = (typeof proposalOriginValues)[number];

export const eventTypeValues = [
  "work",
  "study",
  "emotion",
  "decision",
  "project",
  "relationship",
  "other",
] as const;
export type EventType = (typeof eventTypeValues)[number];

export const evidenceArtifactTypeValues = [
  "daily_entry",
  "pasted_text",
  "uploaded_file",
  "external_snapshot",
  "feishu_message",
] as const;
export type EvidenceArtifactType = (typeof evidenceArtifactTypeValues)[number];

export const evidenceRevisionTypeValues = ["original", "parsed"] as const;
export type EvidenceRevisionType = (typeof evidenceRevisionTypeValues)[number];

export const evidencePrivacyLevelValues = ["private", "sensitive", "restricted"] as const;
export type EvidencePrivacyLevel = (typeof evidencePrivacyLevelValues)[number];

export const eventTimePrecisionValues = [
  "exact",
  "day",
  "month",
  "year",
  "approximate",
  "unknown",
] as const;
export type EventTimePrecision = (typeof eventTimePrecisionValues)[number];

export const eventRecordStatusValues = ["confirmed", "disputed"] as const;
export type EventRecordStatus = (typeof eventRecordStatusValues)[number];

export const eventSourceRoleValues = ["primary", "supporting"] as const;
export type EventSourceRole = (typeof eventSourceRoleValues)[number];

export const changeActorTypeValues = ["user", "ai"] as const;
export type ChangeActorType = (typeof changeActorTypeValues)[number];

export const graphRelationStatusValues = ["candidate", "confirmed", "rejected"] as const;
export type GraphRelationStatus = (typeof graphRelationStatusValues)[number];

export const goalStatusValues = ["draft", "active", "achieved", "paused", "abandoned"] as const;
export type GoalStatus = (typeof goalStatusValues)[number];

export const futurePlanStatusValues = ["draft", "active", "completed", "paused", "abandoned"] as const;
export type FuturePlanStatus = (typeof futurePlanStatusValues)[number];

export const milestoneStatusValues = ["planned", "active", "completed", "missed"] as const;
export type MilestoneStatus = (typeof milestoneStatusValues)[number];

export const actionItemStatusValues = ["todo", "doing", "done", "cancelled"] as const;
export type ActionItemStatus = (typeof actionItemStatusValues)[number];

export const projectStatusValues = [
  "planned",
  "active",
  "completed",
  "archived",
] as const;
export type ProjectStatus = (typeof projectStatusValues)[number];

export const importedFileTypeValues = ["pdf", "word", "txt", "markdown"] as const;
export type ImportedFileType = (typeof importedFileTypeValues)[number];

export const importedFileSourceTypeValues = ["resume", "history", "other"] as const;
export type ImportedFileSourceType = (typeof importedFileSourceTypeValues)[number];

export const importedFileParseStatusValues = ["pending", "succeeded", "failed"] as const;
export type ImportedFileParseStatus = (typeof importedFileParseStatusValues)[number];

export const resumeDocumentSourceValues = ["pasted", "uploaded"] as const;
export type ResumeDocumentSource = (typeof resumeDocumentSourceValues)[number];

export const resumeMaterialSourceTypeValues = [
  "ability_evidence",
  "project",
  "resume_document",
  "daily_entry",
  "manual",
] as const;
export type ResumeMaterialSourceType = (typeof resumeMaterialSourceTypeValues)[number];

export const resumeMaterialTypeValues = [
  "achievement",
  "responsibility",
  "skill",
  "project_summary",
  "reflection",
  "other",
] as const;
export type ResumeMaterialType = (typeof resumeMaterialTypeValues)[number];

export const resumeMaterialStatusValues = ["candidate", "confirmed", "rejected"] as const;
export type ResumeMaterialStatus = (typeof resumeMaterialStatusValues)[number];

export const toolCallStatusValues = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const;
export type ToolCallStatus = (typeof toolCallStatusValues)[number];

export const metricScoreRange = { min: 1, max: 5 } as const;
export const abilityEvidenceScoreRange = { min: 1, max: 5 } as const;
export const abilityFeedbackScoreRange = { min: -2, max: 2 } as const;
