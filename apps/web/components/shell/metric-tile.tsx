import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const metricPalette = {
  "成长性": {
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200",
    active: "bg-emerald-500"
  },
  "情绪消耗": {
    badge:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200",
    active: "bg-amber-500"
  },
  "长期匹配": {
    badge:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200",
    active: "bg-sky-500"
  },
  "沟通压力": {
    badge:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200",
    active: "bg-violet-500"
  }
} as const;

export function MetricTile({
  name,
  score,
  detail,
  trend
}: {
  name: string;
  score: number;
  detail: string;
  trend: string;
}) {
  const palette = metricPalette[name as keyof typeof metricPalette] ?? metricPalette["成长性"];

  return (
    <Card className="glass-soft min-h-[188px] border-white/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {name}
          </CardTitle>
          <span className={cn("rounded-full border px-2 py-1 text-xs font-medium", palette.badge)}>
            {trend}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="flex items-end gap-3">
          <span className="text-4xl font-semibold tracking-tight text-foreground">
            {score}
          </span>
          <span className="pb-1 text-sm text-muted-foreground">/ 5</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <span
              key={`${name}-${index}`}
              className={cn(
                "h-2 rounded-full",
                index < score ? palette.active : "bg-white/10"
              )}
            />
          ))}
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
