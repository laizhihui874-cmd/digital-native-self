"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { SectionCard } from "@/components/shell/section-card";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api-client";
import {
  createDailyEntry,
  createMemoryCandidatesForStructuredDailyReport,
  createStructuredReportDraftForDailyEntry,
  createStructuredReportGenerateForDailyEntry,
  getDailyEntry,
  listMetricRatingsForDailyEntry,
  listDailyEntries,
  type CreateStructuredDailyReportMemoryCandidatesResponse,
  type DailyEntry,
  type DailyEntryDetail,
  type MetricRatingValue,
  type MetricType,
  upsertMetricRatingForDailyEntry,
} from "@/lib/daily-entries";

const listLimit = 6;

type SaveState =
  | { type: "idle" }
  | { type: "success"; entry: DailyEntryDetail; requestId: string }
  | { type: "error"; message: string; requestId?: string };

type StructuredDraftActionState =
  | { type: "idle" }
  | { type: "success"; message: string; requestId?: string }
  | { type: "conflict"; message: string; requestId?: string }
  | { type: "error"; message: string; requestId?: string };

type MemoryCandidateActionState =
  | { type: "idle" }
  | {
      type: "success";
      result: CreateStructuredDailyReportMemoryCandidatesResponse;
      requestId?: string;
    }
  | { type: "error"; message: string; requestId?: string };

type MetricActionState =
  | { type: "idle" }
  | { type: "success"; metricType: MetricType; message: string; requestId?: string }
  | { type: "error"; metricType?: MetricType; message: string; requestId?: string };

const metricDefinitions = [
  {
    metricType: "growth",
    label: "成长性",
    toneClassName: "border-emerald-500/20 bg-emerald-500/10",
  },
  {
    metricType: "emotional_drain",
    label: "情绪消耗",
    toneClassName: "border-amber-500/20 bg-amber-500/10",
  },
  {
    metricType: "long_term_fit",
    label: "长期匹配",
    toneClassName: "border-sky-500/20 bg-sky-500/10",
  },
  {
    metricType: "communication_pressure",
    label: "沟通压力",
    toneClassName: "border-violet-500/20 bg-violet-500/10",
  },
] as const satisfies ReadonlyArray<{
  metricType: MetricType;
  label: string;
  toneClassName: string;
}>;

function createEmptyMetricDrafts(): Record<MetricType, string> {
  return {
    growth: "",
    emotional_drain: "",
    long_term_fit: "",
    communication_pressure: "",
  };
}

function getPreferredMetricScore(metricRating?: MetricRatingValue | null) {
  return metricRating?.finalScore ?? metricRating?.userScore ?? metricRating?.aiScore ?? null;
}

function buildMetricDrafts(metricRatings: MetricRatingValue[]) {
  const drafts = createEmptyMetricDrafts();
  const metricRatingsByType = new Map(metricRatings.map((rating) => [rating.metricType, rating]));

  for (const metric of metricDefinitions) {
    const score = getPreferredMetricScore(metricRatingsByType.get(metric.metricType));
    drafts[metric.metricType] = score == null ? "" : String(score);
  }

  return drafts;
}

export default function DailyEntryTodayPage() {
  const [rawContent, setRawContent] = useState("");
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<DailyEntryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ type: "idle" });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDraftGenerating, setIsDraftGenerating] = useState(false);
  const [isModelGenerating, setIsModelGenerating] = useState(false);
  const [draftActionState, setDraftActionState] =
    useState<StructuredDraftActionState>({ type: "idle" });
  const [isMemoryCandidateGenerating, setIsMemoryCandidateGenerating] = useState(false);
  const [memoryCandidateState, setMemoryCandidateState] =
    useState<MemoryCandidateActionState>({ type: "idle" });
  const [metricRatings, setMetricRatings] = useState<MetricRatingValue[]>([]);
  const [metricDrafts, setMetricDrafts] =
    useState<Record<MetricType, string>>(createEmptyMetricDrafts);
  const [isMetricLoading, setIsMetricLoading] = useState(false);
  const [savingMetricType, setSavingMetricType] = useState<MetricType | null>(null);
  const [metricLoadError, setMetricLoadError] = useState<string | null>(null);
  const [metricActionState, setMetricActionState] = useState<MetricActionState>({ type: "idle" });

  const loadEntryDetail = useCallback(async (entryId: string) => {
    const response = await getDailyEntry(entryId);
    setSelectedEntry(response.data);
    return response.data;
  }, []);

  const syncMetricRatings = useCallback(
    async (entryId: string, fallbackMetrics: MetricRatingValue[] = []) => {
      setIsMetricLoading(true);
      setMetricLoadError(null);

      try {
        const response = await listMetricRatingsForDailyEntry(entryId);
        setMetricRatings(response.data);
        setMetricDrafts(buildMetricDrafts(response.data));
        setSelectedEntry((current) =>
          current?.id === entryId
            ? {
                ...current,
                metrics: response.data,
              }
            : current,
        );

        return response.data;
      } catch (error) {
        if (fallbackMetrics.length === 0) {
          setMetricRatings([]);
          setMetricDrafts(createEmptyMetricDrafts());
        }

        setMetricLoadError(
          error instanceof ApiClientError
            ? `${error.message}${error.requestId ? `（requestId: ${error.requestId}）` : ""}`
            : "四项指标暂时没有刷新成功，你仍可以稍后重新确认。",
        );
        return fallbackMetrics;
      } finally {
        setIsMetricLoading(false);
      }
    },
    [],
  );

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await listDailyEntries({ limit: listLimit, offset: 0 });
      setEntries(response.data.items);
      const currentId = selectedEntry?.id;
      const preferredId = currentId ?? response.data.items[0]?.id;

      if (!preferredId) {
        setSelectedEntry(null);
        return;
      }

      try {
        await loadEntryDetail(preferredId);
      } catch {
        const fallback = response.data.items.find((item) => item.id === preferredId);
        setSelectedEntry(
          fallback
            ? {
                ...fallback,
                metrics: [],
                events: [],
                structuredReport: null,
              }
            : null,
        );
      }
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? `${error.message}${error.requestId ? `（requestId: ${error.requestId}）` : ""}`
          : "当前无法连接 DailyEntry API，请确认后端服务已启动。";
      setLoadError(message);
      setEntries([]);
      setSelectedEntry(null);
    } finally {
      setIsLoading(false);
    }
  }, [loadEntryDetail, selectedEntry?.id]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    const selectedEntryId = selectedEntry?.id;

    if (!selectedEntryId) {
      setMetricRatings([]);
      setMetricDrafts(createEmptyMetricDrafts());
      setMetricLoadError(null);
      setMetricActionState({ type: "idle" });
      setSavingMetricType(null);
      return;
    }

    setMetricActionState({ type: "idle" });
    void syncMetricRatings(selectedEntryId);
  }, [selectedEntry?.id, syncMetricRatings]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const content = rawContent.trim();
      if (!content) {
        setSaveState({ type: "error", message: "请先输入今天的记录内容。" });
        return;
      }

      setIsSubmitting(true);
      setSaveState({ type: "idle" });

      try {
        const response = await createDailyEntry({ rawContent: content });
        setRawContent("");
        setSelectedEntry(response.data);
        setDraftActionState({ type: "idle" });
        setMemoryCandidateState({ type: "idle" });
        setSaveState({
          type: "success",
          entry: response.data,
          requestId: response.requestId,
        });
        await loadEntries();
      } catch (error) {
        if (error instanceof ApiClientError) {
          setSaveState({
            type: "error",
            message: error.message,
            requestId: error.requestId,
          });
        } else {
          setSaveState({
            type: "error",
            message: "保存失败，请稍后重试。",
          });
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [loadEntries, rawContent],
  );

  const detailSections = useMemo(() => {
    const report = selectedEntry?.structuredReport;

    return {
      facts: report?.facts ?? [],
      emotions: report?.emotions ?? [],
      growthEvidence: report?.growthEvidence ?? [],
      drainSources: report?.drainSources ?? [],
      decisionImpact: report?.decisionImpact ?? [],
      tomorrow: report?.nextActions ?? [],
      workItems: report?.workItems ?? [],
      feedback: report?.feedback ?? [],
    };
  }, [selectedEntry]);

  const metricRatingsByType = useMemo(
    () => new Map(metricRatings.map((metric) => [metric.metricType, metric])),
    [metricRatings],
  );

  const handleSelectEntry = useCallback(async (entry: DailyEntry) => {
    setDraftActionState({ type: "idle" });
    setMemoryCandidateState({ type: "idle" });

    try {
      await loadEntryDetail(entry.id);
    } catch {
      setSelectedEntry({
        ...entry,
        metrics: [],
        events: [],
        structuredReport: null,
      });
    }
  }, [loadEntryDetail]);

  const handleCreateStructuredDraft = useCallback(async () => {
    if (!selectedEntry) {
      return;
    }

    setIsDraftGenerating(true);
    setDraftActionState({ type: "idle" });
    setMemoryCandidateState({ type: "idle" });

    try {
      const response = await createStructuredReportDraftForDailyEntry(selectedEntry.id);
      await loadEntryDetail(selectedEntry.id);
      setDraftActionState({
        type: "success",
        message: "已生成本地结构化草稿。当前内容仅供你继续确认和整理，不会视为最终理解。",
        requestId: response.requestId,
      });
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        try {
          await loadEntryDetail(selectedEntry.id);
        } catch {
          // Ignore refresh failures here and keep the conflict message visible.
        }

        setDraftActionState({
          type: "conflict",
          message: "已存在结构化日报，可直接继续生成候选记忆。",
          requestId: error.requestId,
        });
        return;
      }

      setDraftActionState({
        type: "error",
        message: error instanceof ApiClientError ? error.message : "生成失败，请稍后重试。",
        requestId: error instanceof ApiClientError ? error.requestId : undefined,
      });
    } finally {
      setIsDraftGenerating(false);
    }
  }, [loadEntryDetail, selectedEntry]);

  const handleCreateStructuredReportWithModel = useCallback(async () => {
    if (!selectedEntry) {
      return;
    }

    setIsModelGenerating(true);
    setDraftActionState({ type: "idle" });
    setMemoryCandidateState({ type: "idle" });
    setMetricActionState({ type: "idle" });

    try {
      const response = await createStructuredReportGenerateForDailyEntry(selectedEntry.id);
      await loadEntryDetail(selectedEntry.id);
      await syncMetricRatings(selectedEntry.id, selectedEntry.metrics ?? []);
      setDraftActionState({
        type: "success",
        message:
          "已通过模型生成结构化日报，并写入四项 AI 初判。日报内容和指标分数都仍需你确认后，才进入后续判断。",
        requestId: response.requestId,
      });
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        try {
          await loadEntryDetail(selectedEntry.id);
          await syncMetricRatings(selectedEntry.id, selectedEntry.metrics ?? []);
        } catch {
          // Keep the conflict message visible even if refresh fails.
        }

        setDraftActionState({
          type: "conflict",
          message: "已存在结构化日报，可直接查看内容、确认指标，或继续生成候选记忆。",
          requestId: error.requestId,
        });
        return;
      }

      setDraftActionState({
        type: "error",
        message:
          error instanceof ApiClientError
            ? error.message
            : "AI 生成暂时失败，请稍后重试，或先使用本地结构化草稿。",
        requestId: error instanceof ApiClientError ? error.requestId : undefined,
      });
    } finally {
      setIsModelGenerating(false);
    }
  }, [loadEntryDetail, selectedEntry, syncMetricRatings]);

  const handleCreateMemoryCandidates = useCallback(async () => {
    if (!selectedEntry?.structuredReport) {
      return;
    }

    setIsMemoryCandidateGenerating(true);
    setMemoryCandidateState({ type: "idle" });

    try {
      const response = await createMemoryCandidatesForStructuredDailyReport(selectedEntry.id);
      setMemoryCandidateState({
        type: "success",
        result: response.data,
        requestId: response.requestId,
      });
    } catch (error) {
      setMemoryCandidateState({
        type: "error",
        message: error instanceof ApiClientError ? error.message : "生成失败，请稍后重试。",
        requestId: error instanceof ApiClientError ? error.requestId : undefined,
      });
    } finally {
      setIsMemoryCandidateGenerating(false);
    }
  }, [selectedEntry]);

  const handleMetricDraftChange = useCallback((metricType: MetricType, value: string) => {
    setMetricDrafts((current) => ({
      ...current,
      [metricType]: value,
    }));
  }, []);

  const handleConfirmMetric = useCallback(
    async (metricType: MetricType) => {
      if (!selectedEntry) {
        return;
      }

      const selectedScore = Number(metricDrafts[metricType]);

      if (!Number.isInteger(selectedScore) || selectedScore < 1 || selectedScore > 5) {
        setMetricActionState({
          type: "error",
          metricType,
          message: "请先选择 1 到 5 分，再确认这项指标。",
        });
        return;
      }

      const existingMetric = metricRatings.find((metric) => metric.metricType === metricType);
      setSavingMetricType(metricType);
      setMetricActionState({ type: "idle" });

      try {
        const response = await upsertMetricRatingForDailyEntry(selectedEntry.id, {
          metricType,
          aiScore: existingMetric?.aiScore ?? undefined,
          userScore: selectedScore,
          finalScore: selectedScore,
          aiReason: existingMetric?.aiReason ?? undefined,
          confirmedByUser: true,
        });

        const refreshedEntry = await loadEntryDetail(selectedEntry.id).catch(() => null);

        if (refreshedEntry?.metrics) {
          setMetricRatings(refreshedEntry.metrics);
          setMetricDrafts(buildMetricDrafts(refreshedEntry.metrics));
        } else {
          await syncMetricRatings(selectedEntry.id, metricRatings);
        }

        setMetricActionState({
          type: "success",
          metricType,
          message: "已写入本日确认分数。AI 初判会继续保留为候选参考，不直接替代你的确认。",
          requestId: response.requestId,
        });
      } catch (error) {
        setMetricActionState({
          type: "error",
          metricType,
          message: error instanceof ApiClientError ? error.message : "保存失败，请稍后重试。",
          requestId: error instanceof ApiClientError ? error.requestId : undefined,
        });
      } finally {
        setSavingMetricType(null);
      }
    },
    [loadEntryDetail, metricDrafts, metricRatings, selectedEntry, syncMetricRatings],
  );

  return (
    <div className="mx-auto max-w-[1440px] space-y-8">
      <PageHeader
        eyebrow="每日记录详情"
        title="今日每日记录"
        description="手动补录今天的原始记录，并直接写入真实 DailyEntry API。成功后会刷新最近记录列表。"
        actions={
          <Button asChild variant="secondary">
            <Link href="/memories/review">查看长期记忆确认</Link>
          </Button>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <SectionCard
          title="手动新增记录"
          eyebrow="Create Daily Entry"
          description="source 默认由后端保存为 web，这里只提交原始内容。"
        >
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="daily-entry-content">
                今天发生了什么
              </label>
              <textarea
                id="daily-entry-content"
                value={rawContent}
                onChange={(event) => setRawContent(event.target.value)}
                placeholder="例如：今天推进了什么、情绪如何、遇到了什么困难、明天准备做什么。"
                className="min-h-40 w-full rounded-lg border border-white/10 bg-background/50 px-4 py-3 text-sm leading-7 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "保存中..." : "保存今日记录"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void loadEntries()}
                disabled={isLoading || isSubmitting}
              >
                刷新最近记录
              </Button>
            </div>
          </form>

          {saveState.type === "success" ? (
            <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-foreground">
              <p className="font-medium text-foreground">保存成功</p>
              <p className="mt-1 text-muted-foreground">
                记录 ID：{saveState.entry.id}
              </p>
              <p className="text-muted-foreground">
                保存时间：{formatDateTime(saveState.entry.createdAt)}
              </p>
            </div>
          ) : null}

          {saveState.type === "error" ? (
            <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-foreground">
              <p className="font-medium text-foreground">保存失败</p>
              <p className="mt-1 text-muted-foreground">
                {saveState.message}
                {saveState.requestId ? `（requestId: ${saveState.requestId}）` : ""}
              </p>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title="最近记录"
          eyebrow="Recent Entries"
          description="展示 GET /api/daily-entries 返回的最新记录。"
        >
          {loadError ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
              <p className="font-medium text-foreground">暂时无法加载记录</p>
              <p className="mt-1 leading-6 text-muted-foreground">{loadError}</p>
            </div>
          ) : null}

          {!loadError && isLoading ? (
            <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-6 text-sm text-muted-foreground">
              正在加载最近记录...
            </div>
          ) : null}

          {!loadError && !isLoading && entries.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-6 text-sm text-muted-foreground">
              还没有每日记录，可以先手动新增第一条。
            </div>
          ) : null}

          {!loadError && entries.length > 0 ? (
            <div className="space-y-3">
              {entries.map((entry) => {
                const isActive = selectedEntry?.id === entry.id;

                return (
                  <button
                    type="button"
                    key={entry.id}
                    onClick={() => void handleSelectEntry(entry)}
                    className={[
                      "w-full rounded-lg border px-4 py-3 text-left transition",
                      isActive
                        ? "border-primary/30 bg-primary/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {formatDateLabel(entry.recordedAt ?? entry.createdAt)}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                          {entry.rawContent}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-white/10 bg-background/50 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        {entry.source}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </SectionCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.95fr)]">
        <SectionCard
          title="原始记录"
          eyebrow="Raw Entry"
          description={
            selectedEntry
              ? `记录时间：${formatDateTime(selectedEntry.recordedAt ?? selectedEntry.createdAt)}`
              : "当前还没有可展示的记录。"
          }
        >
          {selectedEntry ? (
            <p className="rounded-lg border border-white/10 bg-background/50 px-5 py-4 text-sm leading-7 text-foreground">
              {selectedEntry.rawContent}
            </p>
          ) : (
            <EmptyState text="保存成功后，这里会显示刚提交的原始记录内容。" />
          )}
        </SectionCard>

        <SectionCard
          title="结构化日报"
          eyebrow="Structured Daily Report"
          description={
            selectedEntry?.structuredReport
              ? "这里展示的是待确认的结构化日报，不代表系统已经准确理解，也不会直接进入长期档案。"
              : "当前还没有结构化日报。你可以先生成本地草稿，或调用模型生成待确认版本。"
          }
          actions={
            selectedEntry && !selectedEntry.structuredReport ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleCreateStructuredDraft()}
                  disabled={isDraftGenerating || isModelGenerating}
                >
                  {isDraftGenerating ? "生成中..." : "生成本地结构化草稿"}
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleCreateStructuredReportWithModel()}
                  disabled={isDraftGenerating || isModelGenerating}
                >
                  {isModelGenerating ? "AI 生成中..." : "AI 生成待确认日报"}
                </Button>
              </div>
            ) : undefined
          }
        >
          {draftActionState.type !== "idle" ? (
            <StatusBanner
              tone={draftActionState.type === "error" ? "error" : "info"}
              title={
                draftActionState.type === "success"
                  ? "本地草稿已更新"
                  : draftActionState.type === "conflict"
                    ? "已有结构化日报"
                    : "生成失败"
              }
            >
              {draftActionState.message}
              {draftActionState.requestId ? `（requestId: ${draftActionState.requestId}）` : ""}
            </StatusBanner>
          ) : null}

          {selectedEntry?.structuredReport ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm leading-6 text-foreground">
                <p className="font-medium text-foreground">结构化日报 / 待确认</p>
                <p className="mt-1 text-muted-foreground">
                  这是基于原始记录整理出的结构化结果，便于你继续确认，不会直接当作长期记忆或最终判断归档。
                </p>
              </div>

              {[
                { label: "事实", items: detailSections.facts },
                { label: "情绪", items: detailSections.emotions },
                { label: "工作推进", items: detailSections.workItems },
                { label: "反馈", items: detailSections.feedback },
                { label: "明日行动", items: detailSections.tomorrow },
              ].map((section) => (
                <div key={section.label} className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-medium text-foreground">{section.label}</p>
                  <StructuredList items={section.items} emptyText="暂无内容" />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="当前还没有结构化日报。本地草稿和 AI 生成结果都只是待确认版本，后续仍需你确认内容是否准确。" />
          )}
        </SectionCard>
      </section>

      <SectionCard
        title="四项指标"
        eyebrow="Metric Ratings"
        description="AI 初判只作为候选参考；只有你逐项确认后，才会作为本日指标写入。"
      >
        {!selectedEntry ? (
          <EmptyState text="先选择一条每日记录，再确认今天的四项指标。" />
        ) : (
          <div className="space-y-4">
            {metricActionState.type !== "idle" ? (
              <StatusBanner
                tone={metricActionState.type === "success" ? "success" : "error"}
                title={
                  metricActionState.type === "success" ? "指标已确认" : "指标暂未保存成功"
                }
              >
                {metricActionState.message}
                {metricActionState.requestId
                  ? `（requestId: ${metricActionState.requestId}）`
                  : ""}
              </StatusBanner>
            ) : null}

            {metricLoadError ? (
              <StatusBanner tone="error" title="指标区暂时没有刷新成功">
                {metricLoadError}
              </StatusBanner>
            ) : null}

            {isMetricLoading ? (
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted-foreground">
                正在刷新当前记录的四项指标...
              </div>
            ) : null}

            {metricRatings.length === 0 ? (
              <div className="rounded-lg border border-dashed border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm leading-6 text-muted-foreground">
                当前还没有 AI 初判或历史确认。你可以直接手动填写四项指标；确认后才会成为本日指标。
              </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-2">
              {metricDefinitions.map((metric) => {
                const currentMetric = metricRatingsByType.get(metric.metricType);
                const preferredScore = getPreferredMetricScore(currentMetric);
                const currentScoreLabel = preferredScore == null ? "未设置" : `${preferredScore} / 5`;
                const confirmationLabel = currentMetric
                  ? currentMetric.confirmedByUser
                    ? "已确认"
                    : "待确认"
                  : "尚未填写";

                return (
                  <div
                    key={metric.metricType}
                    className="rounded-lg border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{metric.label}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          当前分数：{currentScoreLabel}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] tracking-[0.12em] text-foreground ${metric.toneClassName}`}
                      >
                        {confirmationLabel}
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div className="rounded-lg border border-white/10 bg-background/40 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          AI 理由
                        </p>
                        <p className="mt-2 text-sm leading-6 text-foreground">
                          {currentMetric?.aiReason?.trim()
                            ? currentMetric.aiReason
                            : "当前没有 AI 理由。这项指标可以由你直接手动确认。"}
                        </p>
                      </div>

                      <div className="grid gap-3 md:grid-cols-[minmax(0,0.7fr)_auto] md:items-end">
                        <div className="space-y-2">
                          <label
                            className="text-sm font-medium text-foreground"
                            htmlFor={`metric-${metric.metricType}`}
                          >
                            你的确认分数
                          </label>
                          <select
                            id={`metric-${metric.metricType}`}
                            value={metricDrafts[metric.metricType]}
                            onChange={(event) =>
                              handleMetricDraftChange(metric.metricType, event.target.value)
                            }
                            disabled={savingMetricType !== null}
                            className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                          >
                            <option value="">请选择 1 到 5 分</option>
                            {[1, 2, 3, 4, 5].map((score) => (
                              <option key={score} value={score}>
                                {score} 分
                              </option>
                            ))}
                          </select>
                        </div>

                        <Button
                          type="button"
                          onClick={() => void handleConfirmMetric(metric.metricType)}
                          disabled={savingMetricType !== null}
                        >
                          {savingMetricType === metric.metricType ? "保存中..." : "确认并保存"}
                        </Button>
                      </div>

                      <p className="text-xs leading-5 text-muted-foreground">
                        AI 初判只保留为候选。写入后的确认分数会作为这条 DailyEntry 的本日指标。
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SectionCard>

      <section className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="事实与情绪拆分"
          eyebrow="Emotion / Fact Split"
          description="当 structuredReport 存在时，事实和情绪会在这里分开展示。"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-medium text-foreground">事实</p>
              <StructuredList items={detailSections.facts} emptyText="暂无事实拆分" />
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-medium text-foreground">情绪</p>
              <StructuredList items={detailSections.emotions} emptyText="暂无情绪拆分" />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="成长证据与消耗来源"
          eyebrow="Evidence"
          description="有本地结构化草稿时，这里展示待确认的草稿分区；没有草稿时保持空态。"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-medium text-foreground">成长证据</p>
              <StructuredList items={detailSections.growthEvidence} emptyText="暂无成长证据" />
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-medium text-foreground">消耗来源</p>
              <StructuredList items={detailSections.drainSources} emptyText="暂无消耗来源" />
            </div>
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <SectionCard
          title="决策影响"
          eyebrow="Decision Impact"
          description="当前记录对人生节点决策的影响解释。"
        >
          {detailSections.decisionImpact.length > 0 ? (
            <div className="space-y-3">
              {detailSections.decisionImpact.map((item, index) => (
                <p
                  key={`${item.detail}-${index}`}
                  className="rounded-lg border border-primary/20 bg-primary/10 px-5 py-4 text-sm leading-7 text-foreground"
                >
                  {item.detail}
                </p>
              ))}
            </div>
          ) : (
            <EmptyState text="当前未生成决策影响解释。" />
          )}
        </SectionCard>

        <SectionCard
          title="候选长期记忆"
          eyebrow="Memory Candidates"
          description="这里只生成候选记忆。候选内容必须由用户确认后，才会进入长期档案。"
          actions={
            selectedEntry?.structuredReport ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleCreateMemoryCandidates()}
                disabled={isMemoryCandidateGenerating}
              >
                {isMemoryCandidateGenerating ? "生成中..." : "生成长期记忆候选"}
              </Button>
            ) : undefined
          }
        >
          {memoryCandidateState.type === "success" ? (
            <StatusBanner tone="success" title="候选记忆已生成">
              已创建 {memoryCandidateState.result.created.length} 条候选记忆，跳过{" "}
              {memoryCandidateState.result.skippedCount} 条重复内容。候选记忆需要用户确认后进入长期档案。
              {memoryCandidateState.requestId
                ? `（requestId: ${memoryCandidateState.requestId}）`
                : ""}
              <div className="mt-3">
                <Button asChild size="sm" variant="secondary">
                  <Link href="/memories/review">去长期记忆确认页</Link>
                </Button>
              </div>
            </StatusBanner>
          ) : null}

          {memoryCandidateState.type === "error" ? (
            <StatusBanner tone="error" title="候选生成失败">
              {memoryCandidateState.message}
              {memoryCandidateState.requestId
                ? `（requestId: ${memoryCandidateState.requestId}）`
                : ""}
            </StatusBanner>
          ) : null}

          {!selectedEntry ? (
            <EmptyState text="先选择一条每日记录，再决定是否生成候选长期记忆。" />
          ) : !selectedEntry.structuredReport ? (
            <EmptyState text="请先生成并查看本地结构化草稿，再决定是否产出候选长期记忆。" />
          ) : memoryCandidateState.type === "idle" ? (
            <EmptyState text="候选记忆只作为待确认条目出现，进入长期档案前仍需要你逐条确认。" />
          ) : null}
        </SectionCard>
      </section>

      <SectionCard
        title="明日行动"
        eyebrow="Next"
        description="先把当日记录沉淀成下一步动作，再回到工作台重新比较路径。"
      >
        {detailSections.tomorrow.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-3">
            {detailSections.tomorrow.map((item, index) => (
              <div
                key={`${item.detail}-${index}`}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-3"
              >
                <p className="text-sm leading-6 text-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="当前没有明日行动条目。" />
        )}
      </SectionCard>
    </div>
  );
}

function StructuredList({
  items,
  emptyText,
}: {
  items: Array<{ title?: string; detail: string }>;
  emptyText: string;
}) {
  if (items.length === 0) {
    return <p className="mt-3 text-sm leading-6 text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
      {items.map((item, index) => (
        <li key={`${item.detail}-${index}`}>
          {item.title ? `${item.title}：` : ""}
          {item.detail}
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm leading-6 text-muted-foreground">
      {text}
    </div>
  );
}

function StatusBanner({
  title,
  children,
  tone,
}: {
  title: string;
  children: React.ReactNode;
  tone: "info" | "success" | "error";
}) {
  const toneClassName =
    tone === "success"
      ? "border-emerald-500/20 bg-emerald-500/10"
      : tone === "error"
        ? "border-rose-500/20 bg-rose-500/10"
        : "border-sky-500/20 bg-sky-500/10";

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm text-foreground ${toneClassName}`}>
      <p className="font-medium text-foreground">{title}</p>
      <div className="mt-1 leading-6 text-muted-foreground">{children}</div>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
