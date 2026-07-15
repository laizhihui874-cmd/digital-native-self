import { DashboardState } from "@/components/dashboard/home-state";

type EmotionPatternCardProps = {
  highlights: string[];
};

export function EmotionPatternCard({ highlights }: EmotionPatternCardProps) {
  return (
    <section className="glass-panel rounded-lg border border-white/12 p-5 sm:p-6">
      <div className="space-y-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
            本周情绪片段
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
            波动来自哪里
          </h2>
        </div>

        <div className="space-y-3">
          {highlights.map((item) => (
            <div
              key={item}
              className="rounded-lg border border-white/12 bg-white/50 px-4 py-3 text-sm leading-6 text-muted-foreground dark:bg-white/5"
            >
              {item}
            </div>
          ))}
        </div>

        <DashboardState
          tone="error"
          title="空状态预留"
          description="当一周记录不足时，这里将提示“暂无稳定模式，请先补充 3 条以上记录”。"
        />
      </div>
    </section>
  );
}
