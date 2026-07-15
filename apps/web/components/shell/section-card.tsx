import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  description,
  eyebrow,
  children,
  className,
  actions
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <Card className={cn("glass-panel overflow-hidden", className)}>
      <CardHeader className="border-b border-white/8 bg-white/4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            {eyebrow ? (
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
                {eyebrow}
              </p>
            ) : null}
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}
