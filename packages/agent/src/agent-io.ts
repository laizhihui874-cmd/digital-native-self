export type ThemeStatus = "on-topic" | "partially-off-topic" | "off-topic";

export type SufficiencyStatus = "insufficient" | "needs-follow-up" | "sufficient";

export type MemoryType =
  | "goal"
  | "ability"
  | "value"
  | "event"
  | "relationship"
  | "recurring_problem"
  | "decision";

export type SourceType =
  | "daily_entry"
  | "structured_daily_report"
  | "memory"
  | "life_decision"
  | "decision_evidence"
  | "ability_evidence"
  | "weekly_review"
  | "external_source"
  | "imported_file"
  | "project";

export interface SourceCitationDraft {
  sourceType: SourceType;
  sourceId: string;
  quote?: string;
  note?: string;
}

export interface ExternalSourceDraft {
  title: string;
  sourceSite: string;
  url: string;
  publishedAt?: string;
  summary?: string;
}

export interface AbilityEvidenceScoreDraft {
  difficultyScore?: 1 | 2 | 3 | 4 | 5;
  independenceScore?: 1 | 2 | 3 | 4 | 5;
  impactScore?: 1 | 2 | 3 | 4 | 5;
  feedbackScore?: -2 | -1 | 0 | 1 | 2;
  recurrenceCount?: number;
}

export interface DailyGuideAgentInput {
  conversationId: string;
  currentMessage: string;
  recentSevenDaySummary?: string;
  currentLifeDecisionId?: string;
  currentLifeDecisionSummary?: string;
}

export interface DailyGuideAgentOutput {
  followUpQuestion: string;
  themeStatus: ThemeStatus;
  informationGaps: string[];
  provisionalSummary: string;
  suggestedNextAgent?: "SufficiencyCheckAgent" | "EmotionFactSplitAgent";
}

export interface SufficiencyCheckAgentInput {
  conversationId: string;
  conversationTranscript: string;
  currentLifeDecisionSummary?: string;
  requiredSections: Array<
    | "facts"
    | "emotions"
    | "difficulties"
    | "learnings"
    | "next_actions"
    | "growth_evidence"
    | "decision_impact"
  >;
}

export interface SufficiencyCheckAgentOutput {
  sufficiencyStatus: SufficiencyStatus;
  themeStatus: ThemeStatus;
  missingInformation: string[];
  shouldContinueAsking: boolean;
  rationale: string;
}

export interface EmotionFactSplitAgentInput {
  rawExpression: string;
  dailyContext?: string;
}

export interface EmotionFactSplitAgentOutput {
  facts: string[];
  emotions: string[];
  assumptions: string[];
  verifiableEvidence: string[];
  holdForLaterConclusions: string[];
}

export interface MemoryCandidateDraft {
  memoryType: MemoryType;
  content: string;
  sourceCitations: SourceCitationDraft[];
  reason: string;
  shouldAskForConfirmation: boolean;
  confidence?: number;
  expiresAt?: string;
}

export interface MemoryExtractionAgentInput {
  structuredDailyReportId: string;
  structuredDailyReportSummary: string;
  existingMemoriesSummary?: string;
}

export interface MemoryExtractionAgentOutput {
  candidates: MemoryCandidateDraft[];
  rejectedObservations?: string[];
}

export interface DecisionPathComparisonDraft {
  pathId: string;
  pathTitle: string;
  supportingEvidence: SourceCitationDraft[];
  opposingEvidence: SourceCitationDraft[];
  risks: string[];
  opportunities?: string[];
}

export interface DecisionAnalysisAgentInput {
  lifeDecisionId: string;
  lifeDecisionSummary: string;
  candidatePaths: Array<{
    pathId: string;
    title: string;
    description?: string;
  }>;
  decisionEvidenceSummary?: string;
  recentEmotionPatternSummary?: string;
  externalSourceSummaries?: ExternalSourceDraft[];
}

export interface DecisionAnalysisAgentOutput {
  pathComparisons: DecisionPathComparisonDraft[];
  suggestedNextSteps: string[];
  decisionAdvice: string;
  evidenceBoundaryNote: string;
}

export interface WeeklyReviewAgentInput {
  periodStart: string;
  periodEnd: string;
  structuredDailyReportsSummary: string;
  confirmedMemoriesSummary?: string;
  decisionEvidenceSummary?: string;
}

export interface WeeklyReviewAgentOutput {
  progressSummary: string;
  abilityChanges: string[];
  emotionPatterns: string[];
  goalDrift: string[];
  nextWeekSuggestions: string[];
  lifePossibilityNotes: string[];
}

export interface CareerResearchAgentInput {
  targetRoleOrDirection: string;
  currentAbilitySummary?: string;
  currentLifeDecisionSummary?: string;
  externalSourceHints?: ExternalSourceDraft[];
}

export interface CareerResearchAgentOutput {
  capabilityRequirements: string[];
  industryTrendSummary: string;
  marketOutlookSummary: string;
  gapAnalysis: string[];
  actionSuggestions: string[];
  citations: ExternalSourceDraft[];
}

export interface ResumePackagingAgentInput {
  targetRole: string;
  resumeText?: string;
  parsedResumeSummary?: string;
  userRecordSummary?: string;
  abilityEvidenceSummary?: string;
  projectSummary?: string;
}

export interface ResumePackagingAgentOutput {
  resumeOptimizationSuggestions: string[];
  experienceHighlights: string[];
  projectPackagingSuggestions: string[];
  gapAnalysis: string[];
}
