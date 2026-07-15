"use client";

import type { AiConversation, AiMessageCitation, AiMessageWithCitations, AiSettings, ArchiveSearchContext, ArchiveSearchHit } from "@digital-self/shared";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { createAiConversation, deleteAiConversation, getAiMessages, getAiSettings, listAiConversations, renameAiConversation, streamAiMessage } from "@/lib/ai";

type RetrievalMeta = { model: string; count: number; characters: number; hits: ArchiveSearchHit[]; tokens?: number | null; latencyMs?: number | null; citationCheckPassed?: boolean | null };
type RetryMessage = { id: string; content: string };

export function AssistantWorkspace() {
  const params = useSearchParams();
  const context = useMemo(() => readContext(params.get("contextType"), params.get("contextId")), [params]);
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessageWithCitations[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [retrieval, setRetrieval] = useState<RetrievalMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<RetryMessage | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([getAiSettings(), listAiConversations()]).then(([settingsResult, conversationsResult]) => {
      setSettings(settingsResult.data); setConversations(conversationsResult.data); setSelectedId(conversationsResult.data[0]?.id ?? null);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "读取档案助手失败。"));
  }, []);
  useEffect(() => { if (!selectedId) { setMessages([]); return; } getAiMessages(selectedId).then(({ data }) => setMessages(data)).catch((cause) => setError(cause instanceof Error ? cause.message : "读取对话失败。")); }, [selectedId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, streaming]);

  async function newConversation() {
    setError(null);
    try { const { data } = await createAiConversation(); setConversations((items) => [data, ...items]); setSelectedId(data.id); setMessages([]); setRetrieval(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "新建对话失败。"); }
  }
  async function rename(item: AiConversation) {
    const title = window.prompt("输入对话名称", item.title)?.trim(); if (!title) return;
    try { const { data } = await renameAiConversation(item.id, title); setConversations((items) => items.map((value) => value.id === item.id ? data : value)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "重命名失败。"); }
  }
  async function remove(item: AiConversation) {
    if (!window.confirm(`删除对话“${item.title}”及其全部消息？`)) return;
    try { await deleteAiConversation(item.id); const remaining = conversations.filter((value) => value.id !== item.id); setConversations(remaining); if (selectedId === item.id) setSelectedId(remaining[0]?.id ?? null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "删除对话失败。"); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); const content = input.trim(); if (!content || busy) return;
    await ask(content);
  }
  async function ask(content: string, retry?: RetryMessage) {
    setBusy(true); setError(null); setStreaming(""); setRetrieval(null);
    let attempted: RetryMessage | null = retry ?? null;
    try {
      let conversationId = selectedId;
      if (!conversationId) { const { data } = await createAiConversation(content.slice(0, 24)); setConversations((items) => [data, ...items]); setSelectedId(data.id); conversationId = data.id; }
      setInput("");
      await streamAiMessage(conversationId, { content, context, retryUserMessageId: retry?.id }, (streamEvent) => {
        if (streamEvent.type === "started") {
          attempted = { id: streamEvent.userMessage.id, content: streamEvent.userMessage.content };
          if (!streamEvent.reused) setMessages((items) => [...items, { ...streamEvent.userMessage, citations: [] }]);
        }
        if (streamEvent.type === "retrieval") setRetrieval({ model: streamEvent.model, count: streamEvent.sentSourceCount, characters: streamEvent.sentCharacterCount, hits: streamEvent.search.hits });
        if (streamEvent.type === "delta") setStreaming((value) => value + streamEvent.text);
        if (streamEvent.type === "completed") { setMessages((items) => [...items, streamEvent.message]); setStreaming(""); setRetrieval((current) => current ? { ...current, tokens: streamEvent.message.totalTokens, latencyMs: streamEvent.message.latencyMs, citationCheckPassed: streamEvent.citationCheckPassed } : current); }
      });
      setRetryMessage(null);
      const refreshed = await listAiConversations(); setConversations(refreshed.data);
    } catch (cause) { setStreaming(""); setRetryMessage(attempted); setError(cause instanceof Error ? cause.message : "回答失败，请稍后重试。"); } finally { setBusy(false); }
  }

  const activeConversation = conversations.find((item) => item.id === selectedId);
  const latestCitations = [...messages].reverse().find((item) => item.role === "assistant" && item.citations.length)?.citations ?? [];
  return (
    <div className="mx-auto max-w-[1440px]">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5 pt-2">
        <div><p className="text-xs font-medium tracking-[0.18em] text-primary">Archive assistant</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">档案助手</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">从本机人生档案查找依据，再由你配置的模型回答。回答不会自动写入正式档案。</p></div>
        <div className="flex gap-2"><Button variant="secondary" onClick={() => void newConversation()}>新建对话</Button><Button asChild variant="secondary"><Link href="/settings/ai">AI 设置</Link></Button></div>
      </header>
      {context && <div className="mb-4 border border-primary/30 bg-primary/5 px-4 py-3 text-sm">当前问题会优先参考这个页面节点：{context.entityType} · {context.entityId.slice(0, 8)}…</div>}
      {error && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-950 dark:bg-rose-950/30 dark:text-rose-100"><span>{error}</span>{retryMessage && <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void ask(retryMessage.content, retryMessage)}>重试这个问题</Button>}</div>}
      {settings && !settings.enabled && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"><span>云端回答尚未启用。本机档案不会因此停止浏览或编辑。</span><Link href="/settings/ai" className="font-medium underline">配置档案助手</Link></div>}

      <div className="grid min-h-[680px] border border-border bg-card/75 lg:grid-cols-[230px_minmax(0,1fr)_300px]">
        <aside className="border-b border-border bg-muted/20 p-3 lg:border-b-0 lg:border-r" aria-label="对话列表">
          <p className="px-2 py-2 text-xs font-medium text-muted-foreground">本机对话</p>
          <div className="space-y-1">{conversations.map((item) => <div key={item.id} className={`group border ${selectedId === item.id ? "border-primary/40 bg-primary/5" : "border-transparent hover:border-border"}`}><button className="w-full px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setSelectedId(item.id)}><span className="block truncate font-medium">{item.title}</span><span className="mt-1 block text-xs text-muted-foreground">{new Date(item.updatedAt).toLocaleDateString("zh-CN")}</span></button><div className="flex border-t border-border/50"><button className="flex-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => void rename(item)}>重命名</button><button className="flex-1 px-2 py-1 text-xs text-muted-foreground hover:text-rose-700" onClick={() => void remove(item)}>删除</button></div></div>)}</div>
          {!conversations.length && <p className="px-2 py-4 text-xs leading-5 text-muted-foreground">还没有对话。提出第一个问题时会自动创建。</p>}
        </aside>

        <main className="flex min-w-0 flex-col">
          <div className="border-b border-border px-5 py-3"><p className="truncate text-sm font-medium">{activeConversation?.title ?? "新的档案问题"}</p></div>
          <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-7" aria-live="polite">
            {!messages.length && !streaming && <div className="mx-auto mt-16 max-w-xl text-center"><div className="mx-auto mb-5 size-12 border border-primary/35 bg-primary/5" /><h2 className="text-xl font-semibold">从有依据的问题开始</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">例如：过去一年哪些工作让我反复感到消耗？我做职业选择时通常看重什么？请把每个判断都连回原始记录。</p></div>}
            {messages.map((message) => <MessageBlock key={message.id} message={message} />)}
            {streaming && <MessageBlock message={{ id: "stream", conversationId: selectedId ?? "", role: "assistant", content: streaming, model: retrieval?.model, status: "completed", createdAt: new Date().toISOString(), citations: [] }} streaming />}
            <div ref={endRef} />
          </div>
          <form className="border-t border-border bg-card p-4" onSubmit={submit}>
            <label className="sr-only" htmlFor="assistant-question">向档案助手提问</label>
            <textarea id="assistant-question" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={3} className="w-full resize-none border border-input bg-background px-4 py-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-ring" placeholder="问一个需要回到人生记录里查证的问题…" disabled={busy || !settings?.enabled} />
            <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Enter 发送，Shift + Enter 换行。档案片段会被当作不可信资料处理。</p><Button type="submit" disabled={busy || !input.trim() || !settings?.enabled}>{busy ? "正在查找与回答…" : "发送问题"}</Button></div>
          </form>
        </main>

        <aside className="border-t border-border bg-muted/15 p-4 lg:border-l lg:border-t-0" aria-label="本次回答来源">
          <p className="text-xs font-medium text-muted-foreground">本次来源</p>
          {retrieval && <dl className="mt-3 grid grid-cols-2 gap-2 border border-border bg-card p-3 text-xs"><div><dt className="text-muted-foreground">模型</dt><dd className="mt-1 truncate font-medium">{retrieval.model}</dd></div><div><dt className="text-muted-foreground">来源</dt><dd className="mt-1 font-medium">{retrieval.count} 条</dd></div><div><dt className="text-muted-foreground">发送资料</dt><dd className="mt-1 font-medium">{retrieval.characters.toLocaleString()} 字符</dd></div><div><dt className="text-muted-foreground">Token</dt><dd className="mt-1 font-medium">{retrieval.tokens == null ? "等待返回" : retrieval.tokens.toLocaleString()}</dd></div><div className="col-span-2"><dt className="text-muted-foreground">引用检查</dt><dd className="mt-1 font-medium">{retrieval.citationCheckPassed == null ? "等待回答" : retrieval.citationCheckPassed ? "通过" : "未通过"}{retrieval.latencyMs == null ? "" : ` · ${retrieval.latencyMs}ms`}</dd></div></dl>}
          <div className="mt-4 space-y-2">{(retrieval?.hits.slice(0, 8) ?? []).map((hit) => <Link key={hit.citationId} href={hit.sourcePath} className="block border border-border bg-card p-3 text-sm hover:border-primary/40"><span className="text-xs font-semibold text-primary">{hit.citationId}</span><span className="ml-2 font-medium">{hit.title}</span><span className="mt-2 line-clamp-3 block text-xs leading-5 text-muted-foreground">{hit.excerpt}</span></Link>)}</div>
          {!retrieval && latestCitations.length > 0 && <div className="mt-4 space-y-2">{latestCitations.map((item) => <CitationCard key={item.citation.id} item={item} />)}</div>}
          {!retrieval && !latestCitations.length && <p className="mt-4 text-xs leading-5 text-muted-foreground">发送问题后，这里会显示模型收到的来源、字数和可返回原文的位置。</p>}
        </aside>
      </div>
    </div>
  );
}

function MessageBlock({ message, streaming = false }: { message: AiMessageWithCitations; streaming?: boolean }) {
  if (message.role === "user") return <div className="ml-auto max-w-[78%] border border-border bg-muted/35 px-4 py-3 text-sm leading-6"><p className="whitespace-pre-wrap">{message.content}</p></div>;
  return <article className="max-w-3xl border-l-2 border-primary/55 pl-4"><div className="mb-2 flex flex-wrap items-center gap-2 text-xs"><span className="border border-primary/30 bg-primary/5 px-2 py-1 font-medium text-primary">AI 生成</span>{message.model && <span className="text-muted-foreground">{message.model}</span>}{message.citationCheckPassed === true && <span className="text-emerald-700">引用检查通过</span>}{message.status === "citation_warning" && <span className="border border-amber-300 bg-amber-50 px-2 py-1 text-amber-950">引用检查未通过</span>}</div><p className="whitespace-pre-wrap text-sm leading-7">{renderCitations(message.content, message.citations)}</p>{!streaming && <p className="mt-3 text-xs text-muted-foreground">来源 {message.sourceCount ?? 0} 条 · 发送 {message.sentCharacterCount ?? 0} 字符 · Token {message.totalTokens ?? "未返回"}{message.latencyMs == null ? "" : ` · ${message.latencyMs}ms`}</p>}{streaming && <span className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground"><span className="size-1.5 animate-pulse bg-primary" />正在生成</span>}{message.citations.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{message.citations.map((item) => <Link key={item.citation.id} href={item.sourcePath} className="border border-border bg-card px-2 py-1 text-xs hover:border-primary/40"><span className="font-semibold text-primary">{item.marker}</span> {item.citation.title ?? item.citation.sourceType}</Link>)}</div>}</article>;
}
function renderCitations(content: string, citations: AiMessageCitation[]) { const byMarker = new Map(citations.map((item) => [item.marker, item])); return content.split(/(\[\[S\d+\]\])/g).map((part, index) => { const marker = part.match(/^\[\[(S\d+)\]\]$/)?.[1]; const citation = marker ? byMarker.get(marker) : undefined; return citation ? <Link key={`${part}-${index}`} href={citation.sourcePath} className="font-semibold text-primary underline decoration-primary/40 underline-offset-2">[{marker}]</Link> : <span key={`${part}-${index}`}>{part}</span>; }); }
function CitationCard({ item }: { item: AiMessageCitation }) { return <Link href={item.sourcePath} className="block border border-border bg-card p-3 text-sm hover:border-primary/40"><span className="text-xs font-semibold text-primary">{item.marker}</span><span className="ml-2 font-medium">{item.citation.title ?? item.citation.sourceType}</span><span className="mt-2 line-clamp-3 block text-xs leading-5 text-muted-foreground">{item.citation.excerpt}</span></Link>; }
function readContext(type: string | null, id: string | null): ArchiveSearchContext | undefined { const allowed = new Set(["event", "memory", "project", "ability", "decision", "person", "goal", "plan", "milestone", "action", "artifact"]); return type && id && allowed.has(type) ? { entityType: type as ArchiveSearchContext["entityType"], entityId: id } : undefined; }
