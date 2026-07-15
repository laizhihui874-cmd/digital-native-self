"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Button } from "@/components/ui/button";
import { navItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function TopbarIcon({ kind }: { kind: "chart" | "bell" }) {
  if (kind === "chart") {
    return (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
        <path d="M4 15.5h12M6.5 13V8.5M10 13V5.5M13.5 13v-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M10 4.5a3 3 0 0 1 3 3v1.8c0 .7.2 1.4.7 2l.8 1V13H5.5v-.7l.8-1a3.2 3.2 0 0 0 .7-2V7.5a3 3 0 0 1 3-3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M8.5 15.2a1.8 1.8 0 0 0 3 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function Topbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 mb-5 border-b border-border/60 bg-background/88 backdrop-blur-glass">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6">
        <div className="flex min-h-16 items-center justify-end gap-3 py-3">
          <div className="hidden min-w-[280px] flex-1 items-center rounded-full border border-border/70 bg-white/78 px-5 py-3 text-sm text-muted-foreground shadow-sm md:flex lg:max-w-[520px] dark:bg-card/70">
            <span className="truncate">搜索今天的记录、路径和长期记忆</span>
          </div>
          <button
            type="button"
            className="hidden h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-white/70 text-muted-foreground shadow-sm md:inline-flex dark:bg-card/70"
            aria-label="图表"
          >
            <TopbarIcon kind="chart" />
          </button>
          <button
            type="button"
            className="hidden h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-white/70 text-muted-foreground shadow-sm md:inline-flex dark:bg-card/70"
            aria-label="通知"
          >
            <TopbarIcon kind="bell" />
          </button>
          <Button asChild className="hidden rounded-xl bg-primary px-5 md:inline-flex">
            <Link href="/daily-entry/today">快速记录</Link>
          </Button>
          <div className="md:ml-1">
            <ThemeToggle />
          </div>
        </div>

        <nav
          aria-label="移动端导航"
          className="flex gap-2 overflow-x-auto pb-4 lg:hidden"
        >
          {navItems.map((item) => {
            const isActive =
              item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap rounded-full border px-3 py-2 text-xs font-medium transition-colors",
                  isActive
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border/70 bg-card/70 text-muted-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
