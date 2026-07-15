import Link from "next/link";

import { Button } from "@/components/ui/button";

type DecisionHeroCardProps = {
  title: string;
  stage: string;
  summary: string;
  daysLeft: number;
  keyDate: string;
};

export function DecisionHeroCard({
  title,
  stage,
  summary,
  daysLeft,
  keyDate
}: DecisionHeroCardProps) {
  return (
    <section className="glass-panel overflow-hidden rounded-lg border border-white/12 p-5 sm:p-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_320px]">
        <div className="space-y-5">
          <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
            {stage}
          </div>

          <div className="space-y-3">
            <h1 className="max-w-4xl text-2xl font-semibold tracking-tight text-foreground sm:text-[34px]">
              {title}
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
              {summary}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/daily-entry/today">进入今日记录</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/weekly-review">查看本周复盘</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <div className="rounded-lg border border-white/12 bg-white/50 p-4 shadow-sm dark:bg-white/5">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
              关键日期
            </p>
            <p className="mt-3 text-lg font-semibold text-foreground">{keyDate}</p>
          </div>
          <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/85 p-4 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-500/10">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-emerald-700/80 dark:text-emerald-300/80">
              倒计时
            </p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-4xl font-semibold tracking-tight text-foreground">
                {daysLeft}
              </span>
              <span className="pb-1 text-sm text-muted-foreground">天</span>
            </div>
          </div>
          <div className="rounded-lg border border-violet-200/80 bg-violet-50/80 p-4 shadow-sm dark:border-violet-500/20 dark:bg-violet-500/10">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-violet-700/80 dark:text-violet-300/80">
              当前原则
            </p>
            <p className="mt-3 text-sm leading-6 text-foreground">
              先补关键证据，不在疲惫状态里替自己做最终决定。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
