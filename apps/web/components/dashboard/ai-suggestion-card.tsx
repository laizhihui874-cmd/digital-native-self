import { DashboardState } from "@/components/dashboard/home-state";

type AiSuggestionCardProps = {
  headline: string;
  confidence: string;
  rationale: string[];
  nextActions: string[];
  whyThis: string;
};

export function AiSuggestionCard({
  headline,
  confidence,
  rationale,
  nextActions,
  whyThis
}: AiSuggestionCardProps) {
  return (
    <section className="glass-panel rounded-lg border border-white/12 p-5 sm:p-6">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
              AI 建议
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
              当前更适合先推进什么
            </h2>
          </div>
          <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200">
            {confidence}
          </span>
        </div>

        <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/85 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <p className="text-sm leading-7 text-foreground">{headline}</p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">依据</p>
          <ul className="space-y-3">
            {rationale.map((item) => (
              <li
                key={item}
                className="rounded-lg border border-white/12 bg-white/50 px-4 py-3 text-sm leading-6 text-muted-foreground dark:bg-white/5"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        <DashboardState
          tone="empty"
          title="AI 的边界"
          description={whyThis}
        />

        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">建议下一步</p>
          <ul className="space-y-3">
            {nextActions.map((item) => (
              <li
                key={item}
                className="rounded-lg border border-white/12 bg-white/50 px-4 py-3 text-sm leading-6 text-muted-foreground dark:bg-white/5"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
