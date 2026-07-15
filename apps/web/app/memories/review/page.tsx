"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { SectionCard } from "@/components/shell/section-card";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api-client";
import {
  deleteMemory,
  listMemories,
  reviewMemory,
  type Memory,
  type MemoryStatus,
  type MemoryType,
} from "@/lib/memories";

const listLimit = 12;

type ActionState = {
  type: "idle" | "success" | "error";
  message?: string;
  requestId?: string;
};

type DraftState = Record<
  string,
  {
    content: string;
    memoryType: MemoryType;
    isMomentaryThought: boolean;
    expiresAt: string;
  }
>;

type BusyAction = {
  id: string;
  kind: "confirm" | "reject" | "expire" | "delete";
} | null;

const memoryTypeLabelMap: Record<MemoryType, string> = {
  goal: "目标",
  ability: "能力",
  value: "价值观",
  event: "事件",
  relationship: "关系",
  recurring_problem: "重复问题",
  decision: "决策",
};

const memoryStatusLabelMap: Record<MemoryStatus, string> = {
  candidate: "候选",
  confirmed: "已确认",
  rejected: "已拒绝",
  expired: "已过期",
};

export default function MemoryReviewPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [drafts, setDrafts] = useState<DraftState>({});
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>({ type: "idle" });

  const loadCandidates = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await listMemories({
        status: "candidate",
        limit: listLimit,
        offset: 0,
      });

      setMemories(response.data.items);
      setDrafts((current) => {
        const nextDrafts: DraftState = {};

        for (const memory of response.data.items) {
          nextDrafts[memory.id] = current[memory.id] ?? createDraft(memory);
        }

        return nextDrafts;
      });
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? `${error.message}${error.requestId ? `（requestId: ${error.requestId}）` : ""}`
          : "当前无法连接 Memories API，请确认后端服务已启动。";
      setLoadError(message);
      setMemories([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  const pendingCount = memories.length;
  const thoughtCount = useMemo(
    () => memories.filter((memory) => memory.isMomentaryThought).length,
    [memories],
  );
  const expiringCount = useMemo(
    () => memories.filter((memory) => Boolean(memory.expiresAt)).length,
    [memories],
  );

  const updateDraft = useCallback(
    <K extends keyof DraftState[string]>(id: string, key: K, value: DraftState[string][K]) => {
      setDrafts((current) => ({
        ...current,
        [id]: {
          ...(current[id] ?? createDraft(memories.find((memory) => memory.id === id))),
          [key]: value,
        },
      }));
    },
    [memories],
  );

  const handleReview = useCallback(
    async (memory: Memory, status: Extract<MemoryStatus, "confirmed" | "rejected" | "expired">) => {
      const draft = drafts[memory.id] ?? createDraft(memory);
      setBusyAction({ id: memory.id, kind: status === "confirmed" ? "confirm" : status === "rejected" ? "reject" : "expire" });
      setActionState({ type: "idle" });

      try {
        const response = await reviewMemory(memory.id, {
          status,
          content: draft.content.trim(),
          memoryType: draft.memoryType,
          isMomentaryThought: draft.isMomentaryThought,
          expiresAt: normalizeDateInput(draft.expiresAt),
          changeReason:
            draft.content.trim() !== memory.content.trim()
              ? "用户在确认页修改内容后提交审核。"
              : undefined,
        });

        setMemories((current) => current.filter((item) => item.id !== memory.id));
        setDrafts((current) => {
          const next = { ...current };
          delete next[memory.id];
          return next;
        });
        setActionState({
          type: "success",
          message: `${status === "confirmed" ? "已确认" : status === "rejected" ? "已拒绝" : "已标记过期"}候选记忆。`,
          requestId: response.requestId,
        });
      } catch (error) {
        if (error instanceof ApiClientError) {
          setActionState({
            type: "error",
            message: error.message,
            requestId: error.requestId,
          });
        } else {
          setActionState({
            type: "error",
            message: "提交失败，请稍后重试。",
          });
        }
      } finally {
        setBusyAction(null);
      }
    },
    [drafts],
  );

  const handleDelete = useCallback(async (memory: Memory) => {
    setBusyAction({ id: memory.id, kind: "delete" });
    setActionState({ type: "idle" });

    try {
      const response = await deleteMemory(memory.id);
      setMemories((current) => current.filter((item) => item.id !== memory.id));
      setDrafts((current) => {
        const next = { ...current };
        delete next[memory.id];
        return next;
      });
      setActionState({
        type: "success",
        message: "已删除候选记忆。",
        requestId: response.requestId || undefined,
      });
    } catch (error) {
      if (error instanceof ApiClientError) {
        setActionState({
          type: "error",
          message: error.message,
          requestId: error.requestId,
        });
      } else {
        setActionState({
          type: "error",
          message: "删除失败，请稍后重试。",
        });
      }
    } finally {
      setBusyAction(null);
    }
  }, []);

  return (
    <div className="mx-auto max-w-[1440px] space-y-8">
      <PageHeader
        eyebrow="长期记忆确认"
        title="候选长期记忆批量确认"
        description="从真实 Memories API 读取候选记忆。用户可以修改内容后确认，也可以拒绝或删除。"
        actions={
          <Button asChild variant="secondary">
            <Link href="/ability-tree">查看能力树挂载</Link>
          </Button>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <SectionCard
          title="待确认候选"
          eyebrow="Pending"
          description={`当前待确认 ${pendingCount} 条，列表来自 GET /api/memories?status=candidate&limit=${listLimit}&offset=0。`}
          actions={
            <Button
              type="button"
              variant="ghost"
              onClick={() => void loadCandidates()}
              disabled={isLoading || busyAction !== null}
            >
              刷新
            </Button>
          }
        >
          {actionState.type !== "idle" ? (
            <FeedbackBanner state={actionState} />
          ) : null}

          {loadError ? (
            <ErrorState message={loadError} />
          ) : null}

          {!loadError && isLoading ? (
            <EmptyState text="正在加载候选长期记忆..." />
          ) : null}

          {!loadError && !isLoading && memories.length === 0 ? (
            <EmptyState text="当前没有待确认的候选记忆。API 可用后，新候选会在这里出现。" />
          ) : null}

          {!loadError && memories.length > 0 ? (
            <div className="space-y-4">
              {memories.map((memory) => {
                const draft = drafts[memory.id] ?? createDraft(memory);
                const isBusy = busyAction?.id === memory.id;

                return (
                  <article
                    key={memory.id}
                    className="rounded-lg border border-white/10 bg-white/5 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <MetaBadge text={memoryTypeLabelMap[memory.memoryType]} />
                          <MetaBadge text={memoryStatusLabelMap[memory.status]} />
                          <MetaBadge text={`confidence ${formatConfidence(memory.confidence)}`} />
                          <MetaBadge
                            text={draft.isMomentaryThought ? "当时想法" : "长期记忆"}
                            tone={draft.isMomentaryThought ? "primary" : "default"}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          创建于 {formatDateTime(memory.createdAt)}
                          {memory.expiresAt ? ` · 过期时间 ${formatDateTime(memory.expiresAt)}` : " · 未设置过期时间"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-4">
                      <div className="space-y-2">
                        <label
                          className="text-sm font-medium text-foreground"
                          htmlFor={`memory-content-${memory.id}`}
                        >
                          记忆内容
                        </label>
                        <textarea
                          id={`memory-content-${memory.id}`}
                          value={draft.content}
                          onChange={(event) => updateDraft(memory.id, "content", event.target.value)}
                          className="min-h-28 w-full rounded-lg border border-white/10 bg-background/50 px-4 py-3 text-sm leading-7 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                          placeholder="在确认前，可以先修正候选记忆内容。"
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
                        <div className="space-y-2">
                          <label
                            className="text-sm font-medium text-foreground"
                            htmlFor={`memory-type-${memory.id}`}
                          >
                            类型
                          </label>
                          <select
                            id={`memory-type-${memory.id}`}
                            value={draft.memoryType}
                            onChange={(event) =>
                              updateDraft(memory.id, "memoryType", event.target.value as MemoryType)
                            }
                            className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                          >
                            {Object.entries(memoryTypeLabelMap).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label
                            className="text-sm font-medium text-foreground"
                            htmlFor={`memory-expires-at-${memory.id}`}
                          >
                            过期时间
                          </label>
                          <input
                            id={`memory-expires-at-${memory.id}`}
                            type="datetime-local"
                            value={draft.expiresAt}
                            onChange={(event) => updateDraft(memory.id, "expiresAt", event.target.value)}
                            className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                      </div>

                      <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-background/40 px-4 py-3 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={draft.isMomentaryThought}
                          onChange={(event) =>
                            updateDraft(memory.id, "isMomentaryThought", event.target.checked)
                          }
                          className="h-4 w-4 rounded border-white/20 bg-background/50"
                        />
                        标记为当时想法
                      </label>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() => void handleReview(memory, "confirmed")}
                        disabled={isBusy || !draft.content.trim()}
                      >
                        {isBusy && busyAction?.kind === "confirm" ? "确认中..." : "确认"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void handleReview(memory, "rejected")}
                        disabled={isBusy}
                      >
                        {isBusy && busyAction?.kind === "reject" ? "拒绝中..." : "拒绝"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void handleReview(memory, "expired")}
                        disabled={isBusy}
                      >
                        {isBusy && busyAction?.kind === "expire" ? "处理中..." : "标记过期"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void handleDelete(memory)}
                        disabled={isBusy}
                        className="text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                      >
                        {isBusy && busyAction?.kind === "delete" ? "删除中..." : "删除"}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="处理概览"
            eyebrow="处理概览"
            description="候选记忆按真实接口返回内容汇总，帮助先处理最不容易反悔的条目。"
          >
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
              <SummaryTile label="待确认" value={`${pendingCount} 条`} />
              <SummaryTile label="当时想法" value={`${thoughtCount} 条`} />
              <SummaryTile label="带过期时间" value={`${expiringCount} 条`} />
            </div>
          </SectionCard>

          <SectionCard
            title="处理建议"
            eyebrow="批量策略"
            description="先确认长期稳定的内容，再处理带时效性的判断。"
          >
            <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
              <li className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                价值观、长期目标和稳定能力证据优先确认，减少后续重复判断。
              </li>
              <li className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                “当时想法”建议保留标签，并结合过期时间避免把短期感受误当长期结论。
              </li>
              <li className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                需要完全移除的候选才执行删除；如果只是暂不采纳，优先用拒绝保留操作痕迹。
              </li>
            </ul>
          </SectionCard>

          <SectionCard
            title="后续联动"
            eyebrow="后续联动"
            description="长期记忆确认后，下一步要么挂到能力树，要么回流到决策工作台。"
          >
            <div className="space-y-3">
              <Link
                href="/ability-tree"
                className="block rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-foreground transition-colors hover:bg-white/10"
              >
                去能力树查看能力证据挂载
              </Link>
              <Link
                href="/weekly-review"
                className="block rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-foreground transition-colors hover:bg-white/10"
              >
                去每周复盘查看假设是否被验证
              </Link>
              <Link
                href="/"
                className="block rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-foreground transition-colors hover:bg-white/10"
              >
                回到决策工作台比较路径
              </Link>
            </div>
          </SectionCard>
        </div>
      </section>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-medium text-foreground">{value}</p>
    </div>
  );
}

function MetaBadge({
  text,
  tone = "default",
}: {
  text: string;
  tone?: "default" | "primary";
}) {
  return (
    <span
      className={[
        "rounded-full border px-3 py-1 text-xs",
        tone === "primary"
          ? "border-primary/20 bg-primary/10 text-primary"
          : "border-white/10 bg-background/50 text-muted-foreground",
      ].join(" ")}
    >
      {text}
    </span>
  );
}

function FeedbackBanner({ state }: { state: ActionState }) {
  const className =
    state.type === "success"
      ? "border-emerald-500/20 bg-emerald-500/10"
      : "border-rose-500/20 bg-rose-500/10";

  return (
    <div className={`mb-4 rounded-lg px-4 py-3 text-sm text-foreground ${className}`}>
      <p className="font-medium text-foreground">
        {state.type === "success" ? "操作成功" : "操作失败"}
      </p>
      <p className="mt-1 text-muted-foreground">
        {state.message}
        {state.requestId ? `（requestId: ${state.requestId}）` : ""}
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
      <p className="font-medium text-foreground">暂时无法加载候选记忆</p>
      <p className="mt-1 leading-6 text-muted-foreground">{message}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm leading-6 text-muted-foreground">
      {text}
    </div>
  );
}

function createDraft(memory?: Memory | null) {
  return {
    content: memory?.content ?? "",
    memoryType: memory?.memoryType ?? "event",
    isMomentaryThought: memory?.isMomentaryThought ?? false,
    expiresAt: formatDateTimeInput(memory?.expiresAt ?? null),
  };
}

function normalizeDateInput(value: string) {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateTimeInput(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const pad = (input: number) => String(input).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatConfidence(value?: number | null) {
  if (typeof value !== "number") {
    return "--";
  }

  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.round(normalized)}%`;
}
