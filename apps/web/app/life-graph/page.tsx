import { LifeGraphWorkspace } from "@/components/life-graph/life-graph-workspace";

export default function LifeGraphPage() {
  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <header className="flex flex-col gap-3 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-primary">人生档案馆</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            人生星图
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            沿时间查看事件、记忆、项目、能力与决策之间已有来源依据的联系。
          </p>
        </div>
        <div className="text-xs leading-5 text-muted-foreground sm:max-w-[260px] sm:text-right">
          候选内容会单独标出。图上的距离用于浏览，不代表事实强弱。
        </div>
      </header>

      <LifeGraphWorkspace />
    </div>
  );
}
