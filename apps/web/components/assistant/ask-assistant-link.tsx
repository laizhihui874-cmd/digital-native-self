import type { ArchiveSearchContext } from "@digital-self/shared";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AskAssistantLink({ entityType, entityId, label = "询问档案助手", className }: ArchiveSearchContext & { label?: string; className?: string }) {
  const params = new URLSearchParams({ contextType: entityType, contextId: entityId });
  return <Link href={`/assistant?${params.toString()}`} className={cn(buttonVariants({ variant: "secondary", size: "sm" }), className)}>{label}</Link>;
}
