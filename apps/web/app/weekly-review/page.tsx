"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { SectionCard } from "@/components/shell/section-card";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api-client";
import {
  generateWeeklyReview,
  getLatestWeeklyReview,
  getWeeklyReviewByPeriod,
  type StructuredTextItem,
  type WeeklyReviewDetail,
} from "@/lib/weekly-reviews";

type ActionState =
  | { type: "idle" }
  | { type: "success"; message: string; requestId?: string }
  | { type: "error"; message: string; requestId?: string };

export default function WeeklyReviewPage() {
  const period = useMemo(() => buildRecentSevenDayPeriod(), []);
  const [review, setReview] = useState<WeeklyReviewDetail | null>(null);
  const [latestReview, setLatestReview] = useState<WeeklyReviewDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>({ type: "idle" });

  const loadReview = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await getWeeklyReviewByPeriod({
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
      });

      setReview(response.data);

      if (response.data) {
        setLatestReview(response.data);
      } else {
        const latestResponse = await getLatestWeeklyReview();
        setLatestReview(latestResponse.data);
      }

      setActionState((current) => (current.type === "error" ? { type: "idle" } : current));
    } catch (error) {
      setReview(null);
      setLatestReview(null);
      setLoadError(
        error instanceof ApiClientError
          ? `${error.message}${error.requestId ? `（requestId: ${error.requestId}）` : ""}`
          : "当前无法读取每周复盘，请确认后端服务已启动。",
      );
    } finally {
      setIsLoading(false);
    }
  }, [period.periodEnd, period.periodStart]);

  useEffect(() => {
    void loadReview();
  }, [loadReview]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setActionState({ type: "idle" });

    try {
      const response = await generateWeeklyReview({
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
      });

      setReview(response.data.weeklyReview);
      setLatestReview(response.data.weeklyReview);
      setLoadError(null);
      setActionState({
        type: "success",
        message: buildGenerationSuccessMessage(response.data.sourceSnapshot),
        requestId: response.requestId,
      });
    } catch (error) {
      setActionState({
        type: "error",
        message:
          error instanceof ApiClientError
            ? error.message
            : "生成每周复盘失败，请稍后重试。",
        requestId: error instanceof ApiClientError ? error.requestId : undefined,
      });
    } finally {
      setIsGenerating(false);
    }
  }, [period]);

  const headerDescription = `默认展示最近 7 天（${formatDate(period.periodStart)} 至 ${formatDate(period.periodEnd)}）的 deterministic 周复盘，不提供日期选择器。`;
  const emptyText = latestReview
    ? `当前最近 7 天还没有周复盘。最近一份复盘覆盖 ${formatDate(latestReview.periodStart)} 至 ${formatDate(latestReview.periodEnd)}。`
    : "当前最近 7 天还没有周复盘。你可以直接生成一份 deterministic 周复盘。";
  const emotionItems = review?.emotionPattern?.patterns?.length
    ? review.emotionPattern.patterns
    : review?.emotionPatterns ?? [];

  return (
    <div className="mx-auto max-w-[1440px] space-y-8">
      <PageHeader
        eyebrow="每周复盘"
        title="本周推进、模式与下周建议"
        description={headerDescription}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              disabled={isLoading || isGenerating}
              onClick={() => void loadReview()}
            >
              {isLoading ? "刷新中..." : "刷新"}
            </Button>
            <Button type="button" disabled={isGenerating} onClick={() => void handleGenerate()}>
              {isGenerating ? "生成中..." : "生成 deterministic 周复盘"}
            </Button>
            <Button asChild variant="secondary">
              <Link href="/">回到决策工作台</Link>
            </Button>
          </div>
        }
      />

      {actionState.type !== "idle" ? <FeedbackBanner state={actionState} /> : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="本周推进"
          eyebrow="Progress"
          description="先看推进，再判断是不是值得继续投入。"
        >
          <SummarySectionState
            isLoading={isLoading}
            error={loadError}
            hasReview={Boolean(review)}
            emptyText={emptyText}
            value={review?.progressSummary}
            fallback="本周暂无明确推进摘要。"
          />
        </SectionCard>

        <SectionCard
          title="能力变化"
          eyebrow="Ability Changes"
          description="看本周是否真的增长，而不只是在忙。"
        >
          <ListSectionState
            isLoading={isLoading}
            error={loadError}
            hasReview={Boolean(review)}
            emptyText={emptyText}
            items={review?.abilityChanges ?? []}
            fallback="暂无能力变化证据。"
          />
        </SectionCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <SectionCard
          title="情绪模式"
          eyebrow="Emotion Pattern"
          description="情绪波动要被记录，但不能直接替代结论。"
        >
          <ListSectionState
            isLoading={isLoading}
            error={loadError}
            hasReview={Boolean(review)}
            emptyText={emptyText}
            items={emotionItems}
            fallback="暂无情绪模式。"
          />
        </SectionCard>

        <SectionCard
          title="目标漂移"
          eyebrow="Goal Drift"
          description="提醒自己何时从『看清问题』滑向『急着下结论』。"
        >
          <SummarySectionState
            isLoading={isLoading}
            error={loadError}
            hasReview={Boolean(review)}
            emptyText={emptyText}
            value={review?.goalDrift}
            fallback="暂无目标漂移判断。"
            highlighted
          />
        </SectionCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="下周建议"
          eyebrow="Next Week"
          description="下一步优先补高价值证据，而不是把所有任务都展开。"
        >
          <ListSectionState
            isLoading={isLoading}
            error={loadError}
            hasReview={Boolean(review)}
            emptyText={emptyText}
            items={review?.nextWeekSuggestions ?? []}
            fallback="暂无下周建议。"
          />
        </SectionCard>

        <SectionCard
          title="人生可能性探索"
          eyebrow="Possibilities"
          description="保留开放性，但只讨论和当前节点真的相关的可能性。"
        >
          <SummarySectionState
            isLoading={isLoading}
            error={loadError}
            hasReview={Boolean(review)}
            emptyText={emptyText}
            value={review?.lifePossibilityNotes}
            fallback="暂无人生可能性探索。"
          />
        </SectionCard>
      </section>
    </div>
  );
}

function ListSectionState({
  isLoading,
  error,
  hasReview,
  emptyText,
  items,
  fallback,
}: {
  isLoading: boolean;
  error: string | null;
  hasReview: boolean;
  emptyText: string;
  items: StructuredTextItem[];
  fallback: string;
}) {
  if (isLoading) {
    return <EmptyState text="正在加载最近 7 天周复盘..." />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!hasReview) {
    return <EmptyState text={emptyText} />;
  }

  if (items.length === 0) {
    return <EmptyState text={fallback} />;
  }

  return <StructuredList items={items} emptyText={fallback} />;
}

function SummarySectionState({
  isLoading,
  error,
  hasReview,
  emptyText,
  value,
  fallback,
  highlighted = false,
}: {
  isLoading: boolean;
  error: string | null;
  hasReview: boolean;
  emptyText: string;
  value?: string | null;
  fallback: string;
  highlighted?: boolean;
}) {
  if (isLoading) {
    return <EmptyState text="正在加载最近 7 天周复盘..." />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!hasReview) {
    return <EmptyState text={emptyText} />;
  }

  return <SummaryBlock value={value} fallback={fallback} highlighted={highlighted} />;
}

function StructuredList({
  items,
  emptyText,
}: {
  items: StructuredTextItem[];
  emptyText: string;
}) {
  if (items.length === 0) {
    return <EmptyState text={emptyText} />;
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={`${item.title ?? "item"}-${index}`}
          className="rounded-lg border border-white/10 bg-white/5 p-4"
        >
          {item.title ? <p className="text-sm font-medium text-foreground">{item.title}</p> : null}
          <p className="text-sm leading-6 text-muted-foreground">{item.detail}</p>
          {item.citationIds && item.citationIds.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">引用 {item.citationIds.length} 条</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function SummaryBlock({
  value,
  fallback,
  highlighted = false,
}: {
  value?: string | null;
  fallback: string;
  highlighted?: boolean;
}) {
  return (
    <p
      className={
        highlighted
          ? "rounded-lg border border-primary/20 bg-primary/10 px-5 py-4 text-sm leading-7 text-foreground"
          : "rounded-lg border border-white/10 bg-white/5 px-5 py-4 text-sm leading-7 text-foreground"
      }
    >
      {value?.trim() || fallback}
    </p>
  );
}

function FeedbackBanner({ state }: { state: Exclude<ActionState, { type: "idle" }> }) {
  const toneClassName =
    state.type === "success"
      ? "border-emerald-500/20 bg-emerald-500/10"
      : "border-rose-500/20 bg-rose-500/10";

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm text-foreground ${toneClassName}`}>
      <p className="font-medium text-foreground">
        {state.type === "success" ? "操作成功" : "操作失败"}
      </p>
      <p className="mt-1 leading-6 text-muted-foreground">
        {state.message}
        {state.requestId ? `（requestId: ${state.requestId}）` : ""}
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
      <p className="font-medium text-foreground">暂时无法加载周复盘</p>
      <p className="mt-1 leading-6 text-muted-foreground">{message}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm leading-6 text-muted-foreground">
      {text}
    </div>
  );
}

function buildRecentSevenDayPeriod() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return {
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function buildGenerationSuccessMessage(sourceSnapshot: {
  dailyEntriesRead: number;
  structuredReportsRead: number;
  metricRatingsRead: number;
  confirmedMemoriesRead: number;
  decisionEvidenceRead: number;
}) {
  return `已生成 deterministic 周复盘。读取了 ${sourceSnapshot.dailyEntriesRead} 条日记、${sourceSnapshot.structuredReportsRead} 份结构化日报、${sourceSnapshot.metricRatingsRead} 条指标评分、${sourceSnapshot.confirmedMemoriesRead} 条确认记忆和 ${sourceSnapshot.decisionEvidenceRead} 条决策证据。`;
}
