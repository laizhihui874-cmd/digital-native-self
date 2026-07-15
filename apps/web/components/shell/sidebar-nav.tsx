"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function SidebarGlyph({ kind }: { kind: string }) {
  const common = "h-4 w-4 stroke-[1.8] text-current";

  if (kind === "今日概览") {
    return (
      <svg viewBox="0 0 20 20" fill="none" className={common} aria-hidden="true">
        <path d="M3 10h14M10 3v14" stroke="currentColor" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "每日记录") {
    return (
      <svg viewBox="0 0 20 20" fill="none" className={common} aria-hidden="true">
        <rect x="4" y="3.5" width="12" height="13" rx="2" stroke="currentColor" />
        <path d="M7 7.5h6M7 10h6M7 12.5h4" stroke="currentColor" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "人生星图") {
    return (
      <svg viewBox="0 0 20 20" fill="none" className={common} aria-hidden="true">
        <circle cx="5" cy="6" r="1.5" stroke="currentColor" />
        <circle cx="14.5" cy="5" r="1.5" stroke="currentColor" />
        <circle cx="10" cy="14.5" r="1.5" stroke="currentColor" />
        <path d="m6.4 6.4 6.7-1M5.8 7.3l3.3 5.8M13.8 6.3l-3 6.8" stroke="currentColor" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "长期记忆") {
    return (
      <svg viewBox="0 0 20 20" fill="none" className={common} aria-hidden="true">
        <path
          d="M5 4.5h7.5A2.5 2.5 0 0 1 15 7v8.5l-3-1.8-3 1.8V7A2.5 2.5 0 0 0 6.5 4.5H5Z"
          stroke="currentColor"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (kind === "能力树") {
    return (
      <svg viewBox="0 0 20 20" fill="none" className={common} aria-hidden="true">
        <circle cx="6" cy="5.5" r="1.5" stroke="currentColor" />
        <circle cx="14" cy="5.5" r="1.5" stroke="currentColor" />
        <circle cx="10" cy="14.5" r="1.5" stroke="currentColor" />
        <path d="M6 7v1.5h8V7M10 8.5v4.5" stroke="currentColor" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "每周复盘") {
    return (
      <svg viewBox="0 0 20 20" fill="none" className={common} aria-hidden="true">
        <path d="M4 15.5h12M5.5 12V8M10 12V5.5M14.5 12V9.5" stroke="currentColor" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "外部信息") {
    return (
      <svg viewBox="0 0 20 20" fill="none" className={common} aria-hidden="true">
        <circle cx="10" cy="10" r="6.5" stroke="currentColor" />
        <path d="M3.5 10h13M10 3.5a10 10 0 0 1 0 13M10 3.5a10 10 0 0 0 0 13" stroke="currentColor" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" fill="none" className={common} aria-hidden="true">
      <rect x="4" y="4" width="12" height="12" rx="3" stroke="currentColor" />
      <path d="M7 8h6M7 11h6M7 14h4" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-[288px] shrink-0 flex-col overflow-y-auto border-r border-border/70 bg-white/55 px-5 py-7 backdrop-blur-soft lg:flex dark:bg-card/55">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
            <path
              d="M6 10.5c3 0 5.5-2.5 5.5-5.5H14a4 4 0 0 1 0 8H9.5v2.5A5.5 5.5 0 0 1 4 10h2Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <p className="text-[11px] font-medium tracking-[0.18em] text-primary/80">
            个人工作台
          </p>
          <h1 className="mt-1 text-[17px] font-semibold tracking-tight text-foreground">
            数字原生自我
          </h1>
        </div>
      </div>

      <nav className="mt-10 space-y-1.5" aria-label="主导航">
        {navItems.map((item) => {
          const isActive =
            item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-3 transition-colors",
                isActive
                  ? "bg-emerald-50 text-foreground shadow-sm dark:bg-emerald-500/10"
                  : "text-muted-foreground hover:bg-card/55 hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg border",
                  isActive
                    ? "border-emerald-200/90 bg-white text-emerald-700 dark:border-emerald-500/20 dark:bg-card dark:text-emerald-200"
                    : "border-border/70 bg-card/60 text-muted-foreground"
                )}
              >
                <SidebarGlyph kind={item.label} />
              </span>
              <div className="text-sm font-medium">{item.label}</div>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-xl border border-emerald-200/70 bg-[linear-gradient(180deg,rgba(236,253,245,1)_0%,rgba(217,249,157,0.88)_100%)] p-5 shadow-panel dark:border-emerald-500/20 dark:bg-emerald-500/10">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary shadow-sm dark:bg-card">
          <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
            <path d="M10 4v6l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="1.7" />
          </svg>
        </div>
        <div className="mt-4 text-center">
          <p className="text-base font-semibold tracking-tight text-foreground">记录今天</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            先保留原始记录，再整理成事件、记忆与方向。
          </p>
        </div>
        <Link
          href="/daily-entry/today"
          className="mt-5 flex h-12 items-center justify-center rounded-xl bg-white text-base font-medium text-foreground shadow-sm dark:bg-card"
        >
          进入记录
        </Link>
        <Link
          href="/life-graph"
          className="mt-3 flex h-10 items-center justify-center text-sm font-medium text-emerald-800 hover:underline dark:text-emerald-200"
        >
          查看人生星图
        </Link>
      </div>
    </aside>
  );
}
