"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DashboardState } from "@/components/dashboard/home-state";
import { Button } from "@/components/ui/button";
import {
  listDailyEntries,
  listMetricRatingsForDailyEntry,
  type DailyEntry,
  type MetricRatingValue,
  type MetricType,
} from "@/lib/daily-entries";
import {
  getLifeDecision,
  listLifeDecisions,
  type LifeDecisionDetail,
} from "@/lib/life-decisions";
import { listMemories } from "@/lib/memories";
import { listProjects } from "@/lib/projects";
import { getLatestWeeklyReview, type WeeklyReviewDetail } from "@/lib/weekly-reviews";
import { cn } from "@/lib/utils";

type HomeSnapshot = {
  activeDecision: LifeDecisionDetail | null;
  latestEntry: DailyEntry | null;
  metricRatings: MetricRatingValue[];
  pendingMemoryCount: number;
  activeProjectCount: number;
  latestReview: WeeklyReviewDetail | null;
  failedSections: string[];
};

type HomeLoadState = "loading" | "ready" | "error";

const metricDefinitions: ReadonlyArray<{
  metricType: MetricType;
  name: string;
  tone: string;
}> = [
  {
    metricType: "growth",
    name: "成长性",
    tone: "border-emerald-200/70 bg-emerald-50/75 dark:border-emerald-500/20 dark:bg-emerald-500/10",
  },
  {
    metricType: "emotional_drain",
    name: "情绪消耗",
    tone: "border-amber-200/70 bg-amber-50/75 dark:border-amber-500/20 dark:bg-amber-500/10",
  },
  {
    metricType: "long_term_fit",
    name: "长期匹配",
    tone: "border-sky-200/70 bg-sky-50/75 dark:border-sky-500/20 dark:bg-sky-500/10",
  },
  {
    metricType: "communication_pressure",
    name: "沟通压力",
    tone: "border-violet-200/70 bg-violet-50/75 dark:border-violet-500/20 dark:bg-violet-500/10",
  },
];

export default function HomePage() {
  const [snapshot, setSnapshot] = useState<HomeSnapshot>();
  const [loadState, setLoadState] = useState<HomeLoadState>("loading");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadHomeSnapshot() {
      setLoadState("loading");
      const results = await Promise.allSettled([
        loadActiveDecision(),
        loadLatestEntryAndMetrics(),
        listMemories({ status: "candidate", limit: 1, offset: 0 }),
        listProjects({ status: "active", limit: 1, offset: 0 }),
        getLatestWeeklyReview(),
      ]);

      if (cancelled) return;

      const failedSections: string[] = [];
      const decision = resultValue(results[0], "当前决策", failedSections);
      const entryAndMetrics = resultValue(results[1], "最近记录", failedSections);
      const memories = resultValue(results[2], "待确认记忆", failedSections);
      const projects = resultValue(results[3], "活跃项目", failedSections);
      const review = resultValue(results[4], "最近复盘", failedSections);

      if (failedSections.length === results.length) {
        setSnapshot(undefined);
        setLoadState("error");
        return;
      }

      setSnapshot({
        activeDecision: decision ?? null,
        latestEntry: entryAndMetrics?.entry ?? null,
        metricRatings: entryAndMetrics?.metrics ?? [],
        pendingMemoryCount: memories?.data.pagination.total ?? 0,
        activeProjectCount: projects?.data.pagination.total ?? 0,
        latestReview: review?.data ?? null,
        failedSections,
      });
      setLoadState("ready");
    }

    void loadHomeSnapshot();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const metrics = useMemo(
    () =>
      metricDefinitions.map((definition) => {
        const rating = snapshot?.metricRatings.find(
          (item) => item.metricType === definition.metricType,
        );
        const score = rating ? preferredMetricScore(rating) : null;
        return { ...definition, rating, score };
      }),
    [snapshot?.metricRatings],
  );

  if (loadState === "loading") {
    return (
      <HomeFrame>
        <DashboardState
          tone="loading"
          title="正在整理今天的概览"
          description="读取最近记录、当前决策、待确认记忆和周复盘。"
          className="min-h-36"
        />
      </HomeFrame>
    );
  }

  if (loadState === "error" || !snapshot) {
    return (
      <HomeFrame>
        <DashboardState
          tone="error"
          title="当前无法读取个人档案"
          description="页面不会用样例内容代替你的数据。请确认本机 API 和数据库已启动后重试。"
          className="min-h-36"
        />
        <Button type="button" className="mt-4" onClick={() => setReloadKey((key) => key + 1)}>
          重新读取
        </Button>
      </HomeFrame>
    );
  }

  const decision = snapshot.activeDecision;
  const deadline = describeDeadline(decision?.deadline);
  const dominantEmotions = snapshot.latestReview?.emotionPattern?.dominantEmotions ?? [];
  const reviewSummary =
    snapshot.latestReview?.progressSummary?.trim() ||
    snapshot.latestReview?.emotionPatterns[0]?.detail?.trim() ||
    null;

  return (
    <HomeFrame>
      <header className="flex flex-col gap-4 border-b border-border/70 pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-primary">回到今天</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
            人生档案馆
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
            从今天的原始记录出发，回看已有档案，也看清当前方向还缺哪些证据。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/daily-entry/today">记录今天</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/life-graph">打开人生星图</Link>
          </Button>
        </div>
      </header>

      {snapshot.failedSections.length > 0 && (
        <div className="mt-5 border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
          以下区块本次没有读到：{snapshot.failedSections.join("、")}。其余内容仍来自真实数据。
        </div>
      )}

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_360px]">
        <article className="border border-emerald-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.94)_100%)] p-5 shadow-panel dark:border-emerald-500/20 dark:bg-[linear-gradient(135deg,rgba(25,38,34,0.96)_0%,rgba(23,54,43,0.9)_100%)] sm:p-7">
          {decision ? (
            <div className="flex h-full flex-col justify-between gap-8">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-500/20 dark:bg-white/5 dark:text-emerald-200">
                    当前方向
                  </span>
                  <span className="text-xs text-muted-foreground">{deadline}</span>
                </div>
                <h2 className="mt-5 max-w-[18ch] text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
                  {decision.title}
                </h2>
                {decision.description && (
                  <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {decision.description}
                  </p>
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                  {decision.paths.map((path) => (
                    <span
                      key={path.id}
                      className="border border-white/80 bg-white/75 px-3 py-1.5 text-sm text-foreground dark:border-white/10 dark:bg-white/5"
                    >
                      {path.title}
                    </span>
                  ))}
                  {decision.paths.length === 0 && (
                    <span className="text-sm text-muted-foreground">还没有添加候选路径。</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>{decision.paths.length} 条路径</span>
                <span>{decision.externalSources.length} 条外部来源</span>
                <span>{countDecisionEvidence(decision)} 条路径证据</span>
              </div>
            </div>
          ) : (
            <EmptyDecision />
          )}
        </article>

        <aside className="border border-border/70 bg-card/75 p-5 shadow-panel">
          <p className="text-xs font-medium tracking-[0.12em] text-primary">档案概览</p>
          <dl className="mt-5 divide-y divide-border/70 border-y border-border/70">
            <StatRow label="待确认记忆" value={`${snapshot.pendingMemoryCount}`} href="/memories/review" />
            <StatRow label="活跃项目" value={`${snapshot.activeProjectCount}`} href="/projects" />
            <StatRow
              label="最近记录"
              value={snapshot.latestEntry ? formatDate(snapshot.latestEntry.recordedAt ?? snapshot.latestEntry.createdAt) : "暂无"}
              href="/daily-entry/today"
            />
            <StatRow
              label="最近复盘"
              value={snapshot.latestReview ? formatDate(snapshot.latestReview.periodEnd) : "暂无"}
              href="/weekly-review"
            />
          </dl>
        </aside>
      </section>

      <section className="mt-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">最近一次记录的四项指标</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {snapshot.latestEntry
                ? `来自 ${formatDate(snapshot.latestEntry.recordedAt ?? snapshot.latestEntry.createdAt)} 的记录`
                : "还没有可以计算指标的每日记录"}
            </p>
          </div>
          <Link href="/daily-entry/today" className="text-sm font-medium text-primary hover:underline">
            查看记录
          </Link>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <article key={metric.metricType} className={cn("border p-5", metric.tone)}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-muted-foreground">{metric.name}</p>
                <span className="text-xs text-muted-foreground">
                  {metric.rating?.confirmedByUser ? "已确认" : metric.rating ? "待确认" : "未记录"}
                </span>
              </div>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-semibold tracking-tight text-foreground">
                  {metric.score ?? "--"}
                </span>
                <span className="pb-1 text-sm text-muted-foreground">/ 5</span>
              </div>
              <p className="mt-3 min-h-12 text-sm leading-6 text-muted-foreground">
                {metric.rating?.aiReason?.trim() || "这项指标还没有记录内容。"}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_420px]">
        <article className="overflow-hidden border border-border/70 bg-card/75 shadow-panel">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">候选路径与证据</h2>
              <p className="mt-1 text-sm text-muted-foreground">只显示当前决策中已经保存的路径。</p>
            </div>
            <span className="text-xs text-muted-foreground">{decision?.paths.length ?? 0} 条</span>
          </div>
          {decision?.paths.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[660px] text-left">
                <thead>
                  <tr className="border-b border-border/60 text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-medium">路径</th>
                    <th className="px-5 py-3 font-medium">评分</th>
                    <th className="px-5 py-3 font-medium">支持点</th>
                    <th className="px-5 py-3 font-medium">风险</th>
                    <th className="px-5 py-3 font-medium">证据</th>
                  </tr>
                </thead>
                <tbody>
                  {decision.paths.map((path) => (
                    <tr key={path.id} className="border-b border-border/50 last:border-0">
                      <td className="px-5 py-4 text-sm font-medium text-foreground">{path.title}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {path.currentScore ?? "待评分"}
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{path.benefits[0] ?? "--"}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{path.risks[0] ?? "--"}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{path.evidenceItems.length} 条</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5">
              <DashboardState
                tone="empty"
                title="还没有候选路径"
                description="这里不会填入示例路径。添加真实决策路径后再进行比较。"
              />
            </div>
          )}
        </article>

        <article className="border border-border/70 bg-card/75 p-5 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">最近复盘</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {snapshot.latestReview
                  ? `${formatDate(snapshot.latestReview.periodStart)}—${formatDate(snapshot.latestReview.periodEnd)}`
                  : "尚未生成周复盘"}
              </p>
            </div>
            <Link href="/weekly-review" className="text-sm font-medium text-primary hover:underline">
              打开复盘
            </Link>
          </div>
          {snapshot.latestReview ? (
            <div className="mt-5 space-y-4">
              {dominantEmotions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {dominantEmotions.map((emotion) => (
                    <span key={emotion} className="border border-border bg-background px-3 py-1 text-xs text-foreground">
                      {emotion}
                    </span>
                  ))}
                </div>
              )}
              <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {reviewSummary ?? "这次复盘没有填写摘要。"}
              </p>
              {snapshot.latestReview.nextWeekSuggestions[0]?.detail && (
                <div className="border-l-2 border-primary/40 pl-3 text-sm leading-6 text-muted-foreground">
                  下周：{snapshot.latestReview.nextWeekSuggestions[0].detail}
                </div>
              )}
            </div>
          ) : (
            <DashboardState
              tone="empty"
              title="还没有复盘内容"
              description="积累几天真实记录后，可以生成第一份周复盘。"
              className="mt-5"
            />
          )}
        </article>
      </section>
    </HomeFrame>
  );
}

function HomeFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1440px] pb-8">
      <section className="border border-border/60 bg-white/68 p-4 shadow-panel backdrop-blur-glass dark:border-white/10 dark:bg-card/72 sm:p-6">
        {children}
      </section>
    </div>
  );
}

function EmptyDecision() {
  return (
    <div className="flex min-h-72 flex-col justify-between gap-8">
      <div>
        <span className="border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-500/20 dark:bg-white/5 dark:text-emerald-200">
          当前方向
        </span>
        <h2 className="mt-5 max-w-[18ch] text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
          还没有正在推进的人生决策
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
          页面不会用预设选择替代你的真实情况。可以先记录今天，或从已有事件和记忆中寻找需要处理的方向。
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button asChild><Link href="/daily-entry/today">先记录今天</Link></Button>
        <Button asChild variant="secondary"><Link href="/life-graph">查看已有档案</Link></Button>
      </div>
    </div>
  );
}

function StatRow({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd>
        <Link href={href} className="text-sm font-semibold text-foreground hover:text-primary hover:underline">
          {value}
        </Link>
      </dd>
    </div>
  );
}

async function loadActiveDecision(): Promise<LifeDecisionDetail | null> {
  const response = await listLifeDecisions({ status: "active" });
  const first = response.data[0];
  if (!first) return null;
  return (await getLifeDecision(first.id)).data;
}

async function loadLatestEntryAndMetrics(): Promise<{
  entry: DailyEntry | null;
  metrics: MetricRatingValue[];
}> {
  const response = await listDailyEntries({ limit: 1, offset: 0 });
  const entry = response.data.items[0] ?? null;
  if (!entry) return { entry: null, metrics: [] };
  const metricResponse = await listMetricRatingsForDailyEntry(entry.id);
  return { entry, metrics: metricResponse.data };
}

function resultValue<T>(
  result: PromiseSettledResult<T>,
  label: string,
  failures: string[],
): T | undefined {
  if (result.status === "fulfilled") return result.value;
  failures.push(label);
  return undefined;
}

function preferredMetricScore(rating: MetricRatingValue): number | null {
  return rating.finalScore ?? rating.userScore ?? rating.aiScore ?? null;
}

function describeDeadline(deadline?: string | null): string {
  if (!deadline) return "未设置复核日期";
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return "日期格式无法识别";
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  if (days > 0) return `${formatDate(deadline)} · 还有 ${days} 天`;
  if (days === 0) return `${formatDate(deadline)} · 今天复核`;
  return `${formatDate(deadline)} · 已过 ${Math.abs(days)} 天`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function countDecisionEvidence(decision: LifeDecisionDetail): number {
  return decision.paths.reduce((total, path) => total + path.evidenceItems.length, 0);
}
