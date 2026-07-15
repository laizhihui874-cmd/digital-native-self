import type { ArchiveSearchContext, ArchiveSearchHit } from "@digital-self/shared";

import type { SearchDocument } from "./archive-search.types";

type RankedDocument = { document: SearchDocument; tuple: number[]; matchedTerms: string[] };

const TIME_PHRASES = /今天|今日|昨天|昨日|本周|这周|上周|今年|本年|去年|today|yesterday|this week|last week|this year|last year/giu;

export function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\p{P}\p{S}]+/gu, " ").replace(/\s+/g, " ").trim();
}

export function extractSearchTerms(value: string): string[] {
  const normalized = normalizeSearchText(value).replace(TIME_PHRASES, " ").trim();
  const terms: string[] = [];
  for (const word of normalized.match(/[a-z0-9]{2,}/g) ?? []) terms.push(word);
  for (const sequence of normalized.match(/[\p{Script=Han}]+/gu) ?? []) {
    if (sequence.length === 2) terms.push(sequence);
    for (let index = 0; index < sequence.length - 1; index += 1) terms.push(sequence.slice(index, index + 2));
  }
  return Array.from(new Set(terms));
}

export function rankSearchDocuments(input: {
  query: string;
  documents: SearchDocument[];
  timeZone: string;
  context?: ArchiveSearchContext;
  limit: number;
}): ArchiveSearchHit[] {
  const normalizedQuery = normalizeSearchText(input.query);
  const phrase = normalizeSearchText(input.query.replace(TIME_PHRASES, " "));
  const terms = extractSearchTerms(input.query);
  const timeWindow = createTimeWindow(normalizedQuery, input.timeZone, new Date());
  const ranked: RankedDocument[] = [];

  for (const document of input.documents) {
    const date = document.occurredAt ? new Date(document.occurredAt) : null;
    if (timeWindow && (!date || !timeWindow(date))) continue;
    const title = normalizeSearchText(document.title);
    const content = normalizeSearchText(document.content);
    const matchedTerms = terms.filter((term) => title.includes(term) || content.includes(term));
    const titlePhrase = phrase.length >= 2 && title.includes(phrase) ? 1 : 0;
    const contentPhrase = phrase.length >= 2 && content.includes(phrase) ? 1 : 0;
    const allTerms = terms.length > 0 && matchedTerms.length === terms.length ? 1 : 0;
    const coverage = terms.length ? matchedTerms.length / terms.length : timeWindow ? 1 : 0;
    const occurrences = matchedTerms.reduce((sum, term) => sum + countOccurrences(`${title} ${content}`, term), 0);
    const contextPriority = input.context ? contextRank(document, input.context) : 0;
    if (!titlePhrase && !contentPhrase && !matchedTerms.length && !contextPriority && !timeWindow) continue;
    ranked.push({ document, matchedTerms, tuple: [contextPriority, titlePhrase, contentPhrase, allTerms, coverage, occurrences, date?.getTime() ?? 0] });
  }

  ranked.sort((left, right) => compareTuple(right.tuple, left.tuple));
  const deduplicated = new Map<string, RankedDocument>();
  for (const item of ranked) {
    const key = `${item.document.sourceType}:${item.document.sourceId}`;
    if (!deduplicated.has(key)) deduplicated.set(key, item);
  }

  return Array.from(deduplicated.values()).slice(0, input.limit).map((item, index) => ({
    citationId: `S${index + 1}`,
    sourceType: item.document.sourceType,
    sourceId: item.document.sourceId,
    sourceVersionId: item.document.sourceVersionId,
    title: item.document.title,
    excerpt: buildExcerpt(item.document.content, phrase, item.matchedTerms),
    locator: item.document.locator,
    occurredAt: item.document.occurredAt,
    status: item.document.status,
    matchedTerms: item.matchedTerms,
    sourcePath: sourcePath(item.document),
  }));
}

function contextRank(document: SearchDocument, context: ArchiveSearchContext): number {
  const exact = document.contextRefs[0]?.entityType === context.entityType && document.contextRefs[0]?.entityId === context.entityId;
  if (exact) return 2;
  return document.contextRefs.some((ref) => ref.entityType === context.entityType && ref.entityId === context.entityId) ? 1 : 0;
}
function compareTuple(left: number[], right: number[]): number { for (let i = 0; i < left.length; i += 1) if (left[i] !== right[i]) return left[i] - right[i]; return 0; }
function countOccurrences(text: string, term: string): number { let count = 0; let offset = 0; while ((offset = text.indexOf(term, offset)) >= 0) { count += 1; offset += Math.max(1, term.length); } return count; }
function buildExcerpt(content: string, phrase: string, terms: string[]): string {
  const normalized = content.normalize("NFKC").toLocaleLowerCase();
  const needle = [phrase, ...terms].find((value) => value && normalized.includes(value)) ?? "";
  const matchIndex = needle ? normalized.indexOf(needle) : 0;
  const start = Math.max(0, matchIndex - 180);
  const excerpt = content.slice(start, start + 900).trim();
  return `${start > 0 ? "…" : ""}${excerpt}${start + 900 < content.length ? "…" : ""}`;
}
function sourcePath(document: SearchDocument): string {
  switch (document.sourceType) {
    case "daily_entry": return `/timeline?dailyEntryId=${document.sourceId}`;
    case "event": return `/timeline?eventId=${document.sourceId}`;
    case "memory": return `/archive?memoryId=${document.sourceId}`;
    case "project": return `/projects?projectId=${document.sourceId}`;
    case "ability_evidence": return `/ability-tree?evidenceId=${document.sourceId}`;
    case "life_decision": return `/weekly-review?decisionId=${document.sourceId}`;
    case "person": return `/people?personId=${document.sourceId}`;
    case "goal": case "plan": case "milestone": case "action": return `/planning?entityType=${document.sourceType}&entityId=${document.sourceId}`;
    case "weekly_review": return `/weekly-review?reviewId=${document.sourceId}`;
    default: return `/archive?sourceType=${document.sourceType}&sourceId=${document.sourceId}`;
  }
}

function createTimeWindow(query: string, timeZone: string, now: Date): ((value: Date) => boolean) | null {
  const today = dayNumber(now, timeZone);
  const currentYear = yearNumber(now, timeZone);
  if (/今天|今日|today/u.test(query)) return (value) => dayNumber(value, timeZone) === today;
  if (/昨天|昨日|yesterday/u.test(query)) return (value) => dayNumber(value, timeZone) === today - 1;
  const weekday = new Date(today * 86_400_000).getUTCDay() || 7;
  const thisMonday = today - weekday + 1;
  if (/本周|这周|this week/u.test(query)) return (value) => { const day = dayNumber(value, timeZone); return day >= thisMonday && day <= today; };
  if (/上周|last week/u.test(query)) return (value) => { const day = dayNumber(value, timeZone); return day >= thisMonday - 7 && day < thisMonday; };
  if (/今年|本年|this year/u.test(query)) return (value) => yearNumber(value, timeZone) === currentYear;
  if (/去年|last year/u.test(query)) return (value) => yearNumber(value, timeZone) === currentYear - 1;
  return null;
}
function dateParts(value: Date, timeZone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const get = (type: "year" | "month" | "day") => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day") };
}
function dayNumber(value: Date, timeZone: string): number { const parts = dateParts(value, timeZone); return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000); }
function yearNumber(value: Date, timeZone: string): number { return dateParts(value, timeZone).year; }
