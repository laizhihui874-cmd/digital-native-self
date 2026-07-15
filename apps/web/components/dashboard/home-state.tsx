import { cn } from "@/lib/utils";

type DashboardStateProps = {
  title: string;
  description: string;
  tone?: "loading" | "empty" | "error";
  className?: string;
};

const toneStyles: Record<NonNullable<DashboardStateProps["tone"]>, string> = {
  loading:
    "border-sky-200/80 bg-sky-50/80 text-sky-950 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-50",
  empty:
    "border-amber-200/80 bg-amber-50/80 text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-50",
  error:
    "border-rose-200/80 bg-rose-50/80 text-rose-950 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-50"
};

export function DashboardState({
  title,
  description,
  tone = "loading",
  className
}: DashboardStateProps) {
  return (
    <div className={cn("rounded-lg border p-4", toneStyles[tone], className)}>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm leading-6 opacity-80">{description}</p>
    </div>
  );
}
