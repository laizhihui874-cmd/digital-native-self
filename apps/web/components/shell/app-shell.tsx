import type { ReactNode } from "react";

import { SidebarNav } from "@/components/shell/sidebar-nav";
import { Topbar } from "@/components/shell/topbar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        跳到主要内容
      </a>
      <div className="mx-auto flex max-w-[1600px]">
        <SidebarNav />
        <div className="min-w-0 flex-1">
          <Topbar />
          <main id="main-content" className="px-4 pb-8 sm:px-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
