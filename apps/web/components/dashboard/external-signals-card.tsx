import { DashboardState } from "@/components/dashboard/home-state";

type ExternalSignal = {
  title: string;
  source: string;
  summary: string;
  impact: string;
};

type ExternalSignalsCardProps = {
  signals: ExternalSignal[];
};

export function ExternalSignalsCard({ signals }: ExternalSignalsCardProps) {
  return (
    <section className="glass-panel rounded-lg border border-white/12 p-5 sm:p-6">
      <div className="space-y-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
            外部信息摘要
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
            只保留会影响路径判断的线索
          </h2>
        </div>

        <div className="space-y-3">
          {signals.map((signal) => (
            <article
              key={signal.title}
              className="rounded-lg border border-white/12 bg-white/50 p-4 dark:bg-white/5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-foreground">{signal.title}</h3>
                <span className="text-xs text-muted-foreground">{signal.source}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{signal.summary}</p>
              <p className="mt-3 text-sm leading-6 text-foreground">{signal.impact}</p>
            </article>
          ))}
        </div>

        <DashboardState
          tone="empty"
          title="来源说明"
          description="后续接入真实搜索后，来源会继续保留招聘平台、学校官网、行业报告等引用，不把外部结论写成系统自说自话。"
        />
      </div>
    </section>
  );
}
