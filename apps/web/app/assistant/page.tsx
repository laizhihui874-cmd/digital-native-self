import { Suspense } from "react";

import { AssistantWorkspace } from "./workspace";

export default function AssistantPage() {
  return <Suspense fallback={<div className="mx-auto max-w-[1280px] p-8 text-sm text-muted-foreground">正在打开档案助手…</div>}><AssistantWorkspace /></Suspense>;
}
