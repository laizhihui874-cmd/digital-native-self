"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("digital-self-theme");
    const nextDark = storedTheme === "dark";
    document.documentElement.classList.toggle("dark", nextDark);
    setIsDark(nextDark);
  }, []);

  function toggleTheme() {
    const nextDark = !isDark;
    setIsDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    window.localStorage.setItem(
      "digital-self-theme",
      nextDark ? "dark" : "light"
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "inline-flex h-10 items-center rounded-full border border-border/70 bg-card/70 px-1 shadow-glass backdrop-blur-soft transition-colors",
        isDark ? "justify-end" : "justify-start"
      )}
      aria-label={isDark ? "切换到浅色模式" : "切换到深色模式"}
    >
      <span className="sr-only">切换主题</span>
      <span className="flex w-20 items-center justify-between px-2 text-[11px] font-medium text-muted-foreground">
        <span>浅色</span>
        <span>深色</span>
      </span>
      <span className="h-8 w-8 rounded-full border border-white/10 bg-primary shadow-panel" />
    </button>
  );
}
