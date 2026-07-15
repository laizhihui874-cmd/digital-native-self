import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function PathCard({
  title,
  status,
  score,
  summary,
  support,
  risk
}: {
  title: string;
  status: string;
  score: string;
  summary: string;
  support: string[];
  risk: string[];
}) {
  return (
    <Card className="glass-panel h-full border-white/10">
      <CardHeader className="space-y-4 border-b border-white/8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
              候选路径
            </p>
            <CardTitle className="mt-2 text-lg">{title}</CardTitle>
          </div>
          <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-xs text-muted-foreground">
            {status}
          </span>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-semibold tracking-tight text-foreground">
            {score}
          </span>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{summary}</p>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">支持证据</p>
          <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
            {support.map((item) => (
              <li key={item} className="rounded-md border border-white/8 bg-white/4 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">主要风险</p>
          <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
            {risk.map((item) => (
              <li key={item} className="rounded-md border border-white/8 bg-white/3 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
      <CardFooter>
        <span className="text-xs text-muted-foreground">
          当前为静态骨架，后续接入 `DecisionPath` 与 `DecisionEvidence`。
        </span>
      </CardFooter>
    </Card>
  );
}
