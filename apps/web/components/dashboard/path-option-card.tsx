import { cn } from "@/lib/utils";

type PathOptionCardProps = {
  title: string;
  status: string;
  score: string;
  summary: string;
  support: string[];
  risk: string[];
  accent?: "green" | "blue" | "amber" | "purple";
  compact?: boolean;
};

const accentStyles = {
  green: {
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200",
    dot: "bg-emerald-500"
  },
  blue: {
    badge:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200",
    dot: "bg-sky-500"
  },
  amber: {
    badge:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200",
    dot: "bg-amber-500"
  },
  purple: {
    badge:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200",
    dot: "bg-violet-500"
  }
} as const;

export function PathOptionCard({
  title,
  status,
  score,
  summary,
  support,
  risk,
  accent = "green",
  compact = false
}: PathOptionCardProps) {
  const palette = accentStyles[accent];

  if (compact) {
    return (
      <article className="glass-panel flex h-full flex-col rounded-lg border border-white/12 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold tracking-tight text-foreground">
              {title}
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{summary}</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium",
              palette.badge
            )}
          >
            {status}
          </span>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="text-2xl font-semibold tracking-tight text-foreground">{score}</div>
          <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className={cn("h-2 w-2 rounded-full", palette.dot)} />
            路径状态
          </span>
        </div>

        <div className="mt-4 space-y-2">
          <div className="rounded-lg border border-white/12 bg-white/45 px-3 py-2 text-xs leading-5 text-muted-foreground dark:bg-white/5">
            支持：{support[0]}
          </div>
          <div className="rounded-lg border border-white/10 bg-black/[0.015] px-3 py-2 text-xs leading-5 text-muted-foreground dark:bg-white/[0.03]">
            风险：{risk[0]}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="glass-panel flex h-full flex-col rounded-lg border border-white/12">
      <div className="space-y-4 border-b border-white/10 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
              路径状态
            </p>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
          </div>
          <span className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", palette.badge)}>
            {status}
          </span>
        </div>
        <div className="flex items-end justify-between gap-4">
          <div className="text-3xl font-semibold tracking-tight text-foreground">{score}</div>
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn("h-2 w-2 rounded-full", palette.dot)} />
            当前评估
          </span>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{summary}</p>
      </div>

      <div className="grid flex-1 gap-4 p-5">
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">支持证据</p>
          <ul className="space-y-2">
            {support.map((item) => (
              <li
                key={item}
                className="rounded-lg border border-white/12 bg-white/50 px-3 py-2 text-sm leading-6 text-muted-foreground dark:bg-white/5"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">主要风险</p>
          <ul className="space-y-2">
            {risk.map((item) => (
              <li
                key={item}
                className="rounded-lg border border-white/10 bg-black/[0.015] px-3 py-2 text-sm leading-6 text-muted-foreground dark:bg-white/[0.03]"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}
