import { DashboardState } from "@/components/dashboard/home-state";

type AbilityGrowthCardProps = {
  pendingCount: number;
  suggestedBatchAction: string;
};

export function AbilityGrowthCard({
  pendingCount,
  suggestedBatchAction
}: AbilityGrowthCardProps) {
  return (
    <section className="glass-panel rounded-lg border border-white/12 p-5 sm:p-6">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
              成长证据与长期记忆
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
              先确认，再进入档案
            </h2>
          </div>
          <div className="rounded-lg border border-sky-200/80 bg-sky-50/85 px-3 py-2 text-right dark:border-sky-500/20 dark:bg-sky-500/10">
            <div className="text-2xl font-semibold tracking-tight text-foreground">
              {pendingCount}
            </div>
            <div className="text-xs text-muted-foreground">条待确认</div>
          </div>
        </div>

        <p className="text-sm leading-7 text-muted-foreground">
          长期记忆和能力证据都只展示候选状态。进入正式档案前，需要用户逐条确认、修改或设定有效期。
        </p>

        <DashboardState
          tone="loading"
          title="当前处理建议"
          description={suggestedBatchAction}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-white/12 bg-white/50 p-4 dark:bg-white/5">
            <p className="text-sm font-medium text-foreground">长期记忆</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              价值观、决策假设、阶段性认识都以候选形式进入审核区。
            </p>
          </div>
          <div className="rounded-lg border border-white/12 bg-white/50 p-4 dark:bg-white/5">
            <p className="text-sm font-medium text-foreground">能力证据</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              AI 只推荐挂载位置和评分线索，最终挂载仍由用户确认。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
