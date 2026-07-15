import { DashboardState } from "@/components/dashboard/home-state";

type WeeklyStateCardProps = {
  dominant: string;
  summary: string;
  highlights: string[];
  recommendation: string;
};

export function WeeklyStateCard({
  dominant,
  summary,
  highlights,
  recommendation
}: WeeklyStateCardProps) {
  return (
    <section className="glass-panel rounded-lg border border-white/12 p-5 sm:p-6">
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
            本周情绪模式
          </p>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{dominant}</h2>
          <p className="text-sm leading-7 text-muted-foreground">{summary}</p>
        </div>

        <div className="grid gap-3">
          {highlights.map((item, index) => (
            <div
              key={item}
              className="rounded-lg border border-white/12 bg-white/50 px-4 py-3 text-sm leading-6 text-muted-foreground dark:bg-white/5"
            >
              <span className="mr-2 text-xs font-medium text-emerald-700/75 dark:text-emerald-300/75">
                0{index + 1}
              </span>
              {item}
            </div>
          ))}
        </div>

        <DashboardState
          tone="loading"
          title="本周模式提示"
          description={recommendation}
        />
      </div>
    </section>
  );
}
