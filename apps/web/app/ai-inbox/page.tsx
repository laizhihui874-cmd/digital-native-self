"use client";

import type { ListReviewItemsQuery, ListReviewItemsResponse, ReviewItem, ReviewItemKind } from "@digital-self/shared";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api-client";
import { bulkReviewItems, listReviewItems, reviewItem, undoReviewItem } from "@/lib/review-items";

const PAGE_SIZE = 30;
const kindFilters: Array<{ value?: ReviewItemKind; label: string }> = [
  { label: "全部" },
  { value: "proposal", label: "通用建议" },
  { value: "memory", label: "候选记忆" },
  { value: "ability_evidence", label: "能力证据" },
];

type Draft = { title: string; content: string };
type Status = NonNullable<ListReviewItemsQuery["status"]>;

export default function AiInboxPage() {
  const [result, setResult] = useState<ListReviewItemsResponse | null>(null);
  const [kind, setKind] = useState<ReviewItemKind | undefined>();
  const [status, setStatus] = useState<Status>("candidate");
  const [offset, setOffset] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [queryText, setQueryText] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minConfidence, setMinConfidence] = useState("");
  const [sort, setSort] = useState<NonNullable<ListReviewItemsQuery["sort"]>>("newest");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listReviewItems({
        kind,
        status,
        query: queryText.trim() || undefined,
        sourceType: sourceType.trim() || undefined,
        dateFrom: dateFrom ? `${dateFrom}T00:00:00.000Z` : undefined,
        dateTo: dateTo ? `${dateTo}T23:59:59.999Z` : undefined,
        minConfidence: minConfidence === "" ? undefined : Number(minConfidence) / 100,
        sort,
        limit: PAGE_SIZE,
        offset,
      });
      setResult(response.data);
      setDrafts((current) => Object.fromEntries(response.data.items.map((item) => [itemKey(item), current[itemKey(item)] ?? { title: item.title, content: item.content }])));
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, kind, minConfidence, offset, queryText, sort, sourceType, status]);

  useEffect(() => { void load(); }, [load]);

  const currentKeys = useMemo(() => new Set(result?.items.map(itemKey) ?? []), [result]);
  const selectedItems = result?.items.filter((item) => selected.has(itemKey(item))) ?? [];
  const allCurrentSelected = Boolean(result?.items.length) && result!.items.every((item) => selected.has(itemKey(item)));

  function resetPage() {
    setOffset(0);
    setSelected(new Set());
    setNotice(null);
  }

  function updateDraft(item: ReviewItem, field: keyof Draft, value: string) {
    const key = itemKey(item);
    setDrafts((current) => ({ ...current, [key]: { ...(current[key] ?? { title: item.title, content: item.content }), [field]: value } }));
  }

  function toggleItem(item: ReviewItem) {
    const key = itemKey(item);
    setSelected((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }

  function toggleCurrentPage() {
    setSelected((current) => {
      const next = new Set(current);
      if (allCurrentSelected) for (const key of currentKeys) next.delete(key);
      else for (const key of currentKeys) next.add(key);
      return next;
    });
  }

  async function handleReview(item: ReviewItem, nextStatus: "confirmed" | "rejected") {
    const draft = drafts[itemKey(item)] ?? { title: item.title, content: item.content };
    if (nextStatus === "confirmed" && (!draft.title.trim() || !draft.content.trim())) { setError("确认前请保留标题和正文。"); return; }
    setBusyId(itemKey(item)); setError(null); setNotice(null);
    try {
      await reviewItem(item.kind, item.id, { status: nextStatus, title: draft.title.trim(), content: draft.content.trim(), note: "用户从统一待确认页完成审核。" });
      setNotice(nextStatus === "confirmed" ? "已确认并写入对应的正式档案。" : "已拒绝，这条内容不会进入正式档案。");
      await load();
    } catch (cause) { setError(formatError(cause)); } finally { setBusyId(null); }
  }

  async function handleBulk(nextStatus: "confirmed" | "rejected") {
    if (!selectedItems.length) return;
    if (nextStatus === "confirmed") {
      const invalid = selectedItems.filter((item) => { const draft = drafts[itemKey(item)] ?? { title: item.title, content: item.content }; return !draft.title.trim() || !draft.content.trim(); });
      if (invalid.length) { setError(`有 ${invalid.length} 条缺少标题或正文，不能批量确认。`); return; }
      const preview = selectedItems.slice(0, 8).map((item) => `• ${(drafts[itemKey(item)] ?? item).title}`).join("\n");
      if (!window.confirm(`确认处理 ${selectedItems.length} 条内容？\n\n${preview}${selectedItems.length > 8 ? "\n…" : ""}`)) return;
    } else if (!window.confirm(`拒绝选中的 ${selectedItems.length} 条内容？`)) return;

    setBusyId("bulk"); setError(null); setNotice(null);
    try {
      const response = await bulkReviewItems({
        status: nextStatus,
        note: "用户从统一待确认页批量审核。",
        items: selectedItems.map((item) => {
          const draft = drafts[itemKey(item)] ?? { title: item.title, content: item.content };
          return { kind: item.kind, id: item.id, title: draft.title.trim(), content: draft.content.trim() };
        }),
      });
      const failedKeys = new Set(response.data.results.filter((item) => !item.ok).map((item) => `${item.kind}:${item.id}`));
      setSelected(failedKeys);
      setNotice(`批量处理完成：成功 ${response.data.summary.succeeded} 条，失败 ${response.data.summary.failed} 条。失败项仍保持选中。`);
      const errors = response.data.results.filter((item) => !item.ok).map((item) => `${item.kind}/${item.id.slice(0, 8)}：${item.error}`).join("；");
      if (errors) setError(errors);
      await load();
    } catch (cause) { setError(formatError(cause)); } finally { setBusyId(null); }
  }

  async function handleUndo(item: ReviewItem) {
    setBusyId(itemKey(item)); setError(null); setNotice(null);
    try { await undoReviewItem(item.kind, item.id); setNotice("已恢复为待确认，并保留原审核历史。 "); await load(); }
    catch (cause) { setError(formatError(cause)); } finally { setBusyId(null); }
  }

  const pageStart = result && result.pagination.total > 0 ? result.pagination.offset + 1 : 0;
  const pageEnd = result ? Math.min(result.pagination.offset + result.items.length, result.pagination.total) : 0;

  return (
    <div className="mx-auto max-w-[1240px] space-y-7">
      <PageHeader eyebrow="Review inbox" title="统一待确认" description="把事件建议、候选记忆和能力证据放在同一条审核队列里。只有你点击确认后，它们才会进入正式档案。" />

      <section className="grid gap-3 sm:grid-cols-3" aria-label="待确认数量">
        <CountCard label="通用建议" value={result?.counts.proposal ?? 0} hint="确认后按建议类型写入" />
        <CountCard label="候选记忆" value={result?.counts.memory ?? 0} hint="确认后进入长期记忆" />
        <CountCard label="能力证据" value={result?.counts.ability_evidence ?? 0} hint="确认后进入能力树" />
      </section>

      <div className="border border-border bg-card/75 px-4 py-3 text-sm leading-6 text-muted-foreground">
        全局共有 <strong className="font-semibold text-foreground">{result?.globalPendingCount ?? 0}</strong> 条待确认内容，当前筛选得到 <strong className="font-semibold text-foreground">{result?.filteredCount ?? 0}</strong> 条。AI 产生的新建议不会直接修改正式档案。
      </div>

      {(error || notice) && <div role="status" className={`space-y-1 border px-4 py-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"}`}>{notice && <p>{notice}</p>}{error && <p>{error}</p>}</div>}

      <section className="border border-border bg-card/55">
        <div className="space-y-4 border-b border-border px-4 py-4">
          <div className="flex flex-wrap gap-2" aria-label="审核状态筛选">
            {(["candidate", "confirmed", "rejected"] as Status[]).map((value) => <button key={value} type="button" aria-pressed={status === value} onClick={() => { setStatus(value); resetPage(); }} className={`min-h-9 border px-3 text-sm ${status === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>{value === "candidate" ? "待确认" : value === "confirmed" ? "已确认" : "已拒绝"}</button>)}
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
            <input aria-label="搜索待确认内容" value={queryText} onChange={(event) => { setQueryText(event.target.value); resetPage(); }} placeholder="搜索标题、正文、来源标题" className="h-10 border border-input bg-background px-3 text-sm lg:col-span-2" />
            <input aria-label="来源类型" value={sourceType} onChange={(event) => { setSourceType(event.target.value); resetPage(); }} placeholder="来源类型" className="h-10 border border-input bg-background px-3 text-sm" />
            <input aria-label="开始日期" type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); resetPage(); }} className="h-10 border border-input bg-background px-2 text-sm" />
            <input aria-label="结束日期" type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); resetPage(); }} className="h-10 border border-input bg-background px-2 text-sm" />
            <select aria-label="排序" value={sort} onChange={(event) => { setSort(event.target.value as typeof sort); resetPage(); }} className="h-10 border border-input bg-background px-2 text-sm"><option value="newest">最新优先</option><option value="oldest">最早优先</option><option value="confidence_desc">置信度从高到低</option><option value="confidence_asc">置信度从低到高</option></select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2" aria-label="候选类型筛选">{kindFilters.map((filter) => <button key={filter.label} type="button" aria-pressed={kind === filter.value} onClick={() => { setKind(filter.value); resetPage(); }} className={`min-h-9 border px-3 text-sm ${kind === filter.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>{filter.label}</button>)}</div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">最低置信度 <input aria-label="最低置信度" type="number" min="0" max="100" value={minConfidence} onChange={(event) => { setMinConfidence(event.target.value); resetPage(); }} className="h-9 w-20 border border-input bg-background px-2" />%</label>
          </div>
          {status === "candidate" && <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allCurrentSelected} onChange={toggleCurrentPage} />全选当前页</label><span className="text-sm text-muted-foreground">已选 {selectedItems.length} 条</span><Button type="button" size="sm" disabled={!selectedItems.length || busyId !== null} onClick={() => void handleBulk("confirmed")}>批量确认预览</Button><Button type="button" size="sm" variant="secondary" disabled={!selectedItems.length || busyId !== null} onClick={() => void handleBulk("rejected")}>批量拒绝</Button></div>}
          <p className="text-xs text-muted-foreground">{loading ? "正在读取…" : `显示 ${pageStart}–${pageEnd}，共 ${result?.pagination.total ?? 0} 条`}</p>
        </div>

        {loading && !result ? <QueueSkeleton /> : null}
        {!loading && !error && result?.items.length === 0 ? <div className="px-6 py-16 text-center"><p className="text-lg font-medium">当前筛选没有内容</p><p className="mt-2 text-sm text-muted-foreground">可以调整状态、类型、日期或搜索词。</p></div> : null}

        <div className="divide-y divide-border">
          {result?.items.map((item, index) => {
            const key = itemKey(item);
            const draft = drafts[key] ?? { title: item.title, content: item.content };
            return (
              <article key={key} className="grid gap-5 px-4 py-6 lg:grid-cols-[52px_minmax(0,1fr)_260px] lg:px-6">
                <div className="flex items-start gap-2 lg:block">{status === "candidate" && <input aria-label={`选择 ${item.title}`} type="checkbox" checked={selected.has(key)} onChange={() => toggleItem(item)} className="mt-2" />}<span className="flex size-8 items-center justify-center border border-primary/35 bg-primary/5 text-xs font-semibold text-primary">{String(offset + index + 1).padStart(2, "0")}</span></div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="border border-primary/25 bg-primary/5 px-2 py-1 text-xs font-medium text-primary">{kindLabel(item)}</span>{item.kind === "proposal" && <span className="border border-border px-2 py-1 text-xs text-muted-foreground">{originLabel(item.metadata.origin)}</span>}{item.duplicateCount && <span className="border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-950">完全相同 {item.duplicateCount} 条</span>}<span className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</span></div>
                  <label className="mt-4 block text-xs font-medium text-muted-foreground" htmlFor={`${key}-title`}>标题</label><input id={`${key}-title`} value={draft.title} readOnly={status !== "candidate"} onChange={(event) => updateDraft(item, "title", event.target.value)} className="mt-2 h-11 w-full border border-border bg-background px-3 text-sm font-medium" />
                  <label className="mt-4 block text-xs font-medium text-muted-foreground" htmlFor={`${key}-content`}>正文</label><textarea id={`${key}-content`} value={draft.content} readOnly={status !== "candidate"} onChange={(event) => updateDraft(item, "content", event.target.value)} rows={5} className="mt-2 w-full resize-y border border-border bg-background px-3 py-3 text-sm leading-6" />
                  <div className="mt-4 flex flex-wrap items-center gap-3">{status === "candidate" ? <><Button type="button" disabled={busyId !== null || !draft.title.trim() || !draft.content.trim()} onClick={() => void handleReview(item, "confirmed")}>{busyId === key ? "正在处理…" : "确认进入档案"}</Button><Button type="button" variant="secondary" disabled={busyId !== null} onClick={() => void handleReview(item, "rejected")}>拒绝</Button><span className="text-xs text-muted-foreground">{confirmEffect(item)}</span></> : <Button type="button" variant="secondary" disabled={busyId !== null} onClick={() => void handleUndo(item)}>{busyId === key ? "正在撤销…" : "撤销并恢复待确认"}</Button>}</div>
                </div>
                <aside className="border-l-2 border-primary/25 bg-muted/20 p-4 lg:self-start" aria-label="候选来源与信息"><p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground">来源与信息</p>{item.source ? <><Link href={item.source.path} className="mt-3 block text-sm font-medium text-primary hover:underline">{item.source.title}</Link><p className="mt-1 text-xs text-muted-foreground">{item.source.type}</p></> : <p className="mt-3 text-sm text-muted-foreground">这条候选没有固定来源链接。</p>}{item.source?.excerpt && <p className="mt-2 line-clamp-5 text-xs leading-5 text-muted-foreground">{item.source.excerpt}</p>}<dl className="mt-4 space-y-2 border-t border-border/70 pt-3 text-xs">{metadataRows(item).map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{value}</dd></div>)}</dl></aside>
              </article>
            );
          })}
        </div>

        {result && result.pagination.total > PAGE_SIZE && <div className="flex items-center justify-between border-t border-border px-4 py-4"><Button type="button" variant="secondary" disabled={loading || offset === 0} onClick={() => { setOffset(Math.max(0, offset - PAGE_SIZE)); setSelected(new Set()); }}>上一页</Button><Button type="button" variant="secondary" disabled={loading || offset + PAGE_SIZE >= result.pagination.total} onClick={() => { setOffset(offset + PAGE_SIZE); setSelected(new Set()); }}>下一页</Button></div>}
      </section>
    </div>
  );
}

function CountCard({ label, value, hint }: { label: string; value: number; hint: string }) { return <article className="border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-2 text-xs text-muted-foreground">{hint}</p></article>; }
function QueueSkeleton() { return <div className="space-y-4 px-6 py-8" aria-label="正在载入待确认内容"><div className="h-5 w-36 animate-pulse bg-muted" /><div className="h-28 animate-pulse bg-muted/70" /><div className="h-28 animate-pulse bg-muted/70" /></div>; }
function itemKey(item: ReviewItem) { return `${item.kind}:${item.id}`; }
function kindLabel(item: ReviewItem) { return item.kind === "proposal" ? item.proposalType === "event" ? "事件建议" : "通用建议" : item.kind === "memory" ? "候选记忆" : "能力证据"; }
function originLabel(value: unknown) { return value === "ai" ? "AI 生成" : value === "migration" ? "旧候选迁移" : "手动创建"; }
function formatDate(value: string) { return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value)); }
function confirmEffect(item: ReviewItem) { return item.kind === "proposal" ? "事件建议会创建正式事件并保留审核记录。" : item.kind === "memory" ? "会进入长期记忆，后续可以继续修正。" : "会成为能力树中的已确认证据。"; }
function metadataRows(item: ReviewItem): Array<[string, string]> { if (item.kind === "proposal") return [["事件类型", display(item.metadata.eventType)], ["发生时间", displayDate(item.metadata.occurredAt)], ["时间精度", display(item.metadata.timePrecision)], ["置信度", item.confidence == null ? "未提供" : `${Math.round(item.confidence * 100)}%`]]; if (item.kind === "memory") return [["记忆类型", display(item.metadata.memoryType)], ["即时想法", item.metadata.isMomentaryThought ? "是" : "否"], ["失效时间", displayDate(item.metadata.expiresAt)]]; return [["影响", display(item.metadata.impact)], ["难度", display(item.metadata.difficultyScore)], ["独立性", display(item.metadata.independenceScore)], ["影响分", display(item.metadata.impactScore)], ["重复次数", display(item.metadata.recurrenceCount)]]; }
function display(value: unknown) { return value == null || value === "" ? "未提供" : String(value); }
function displayDate(value: unknown) { return typeof value === "string" && value ? formatDate(value) : "未提供"; }
function formatError(cause: unknown) { return cause instanceof ApiClientError ? `${cause.message}${cause.requestId ? `（requestId: ${cause.requestId}）` : ""}` : cause instanceof Error ? cause.message : "读取待确认内容失败。"; }
