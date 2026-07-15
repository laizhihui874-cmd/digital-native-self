import type { Metadata } from "next";

import { AppShell } from "@/components/shell/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "数字原生自我 MVP",
  description: "数字原生自我前端工作台骨架",
  icons: {
    icon: "/icon.svg"
  }
};

const themeScript = `
  try {
    var stored = localStorage.getItem('digital-self-theme');
    var isDark = stored === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
  } catch (error) {
    document.documentElement.classList.remove('dark');
  }
`;

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
