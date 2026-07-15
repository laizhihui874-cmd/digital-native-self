"use client";

import type { EventCandidateDetail, EventType, EvidenceArtifactDetail } from "@digital-self/shared";
import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { AskAssistantLink } from "@/components/assistant/ask-assistant-link";
import { SectionCard } from "@/components/shell/section-card";
import { Button } from "@/components/ui/button";
import {
  createEventCandidate,
  createTextEvidence,
  getEvidenceArtifact,
  listEventCandidates,
  listEvidenceArtifacts,
  reviewEventCandidate,
  uploadEvidenceFile,
} from "@/lib/archive";

const eventTypeOptions: Array<{ value: EventType; label: string }> = [
  { value: "work", label: "工作" },
  { value: "study", label: "学习" },
  { value: "project", label: "项目" },
  { value: "decision", label: "决定" },
  { value: "relationship", label: "关系" },
  { value: "emotion", label: "情绪" },
  { value: "other", label: "其他" },
];

const fieldClassName =
  "w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15";

export default function ArchivePage() {
  const [artifacts, setArtifacts] = useState<Array<{ id: string; title?: string | null; createdAt: string }>>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<EvidenceArtifactDetail | null>(null);
  const [candidates, setCandidates] = useState<EventCandidateDetail[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventType, setEventType] = useState<EventType>("other");
  const [occurredAt, setOccurredAt] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [artifactResult, candidateResult] = await Promise.all([
      listEvidenceArtifacts(),
      listEventCandidates(),
    ]);
    setArtifacts(artifactResult.data.items);
    setCandidates(candidateResult.data.items);
  }, []);

  useEffect(() => {
    refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "暂时无法读取档案。"));
  }, [refresh]);

  async function handleCreateArtifact(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await createTextEvidence({ title: title.trim() || undefined, content });
      setSelectedArtifact(result.data);
      setTitle("");
      setContent("");
      setMessage("原始资料已保存。原文和内容哈希会保留在第 1 个版本中。");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存原始资料失败。 ");
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectArtifact(id: string) {
    setError(null);
    try {
      const result = await getEvidenceArtifact(id);
      setSelectedArtifact(result.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "读取原始资料失败。 ");
    }
  }

  async function handleUploadFile(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedFile) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await uploadEvidenceFile(selectedFile);
      setSelectedArtifact(result.data);
      setSelectedFile(null);
      setMessage("文件原始字节和解析文本已分开保存。");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "上传原始文件失败。");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateCandidate(event: React.FormEvent) {
    event.preventDefault();
    const fragment = selectedArtifact?.revisions.at(-1)?.fragments[0];
    if (!fragment) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await createEventCandidate({
        evidenceFragmentId: fragment.id,
        title: eventTitle,
        description: eventDescription.trim() || undefined,
        eventType,
        occurredAt: new Date(occurredAt).toISOString(),
        timePrecision: "day",
      });
      setEventTitle("");
      setEventDescription("");
      setMessage("候选事件已加入待确认列表，还没有进入正式时间线。");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建候选事件失败。 ");
    } finally {
      setBusy(false);
    }
  }

  async function handleReview(candidate: EventCandidateDetail, status: "confirmed" | "rejected") {
    setBusy(true);
    setError(null);
    try {
      await reviewEventCandidate(candidate.id, { status, title: candidate.title });
      setMessage(status === "confirmed" ? "事件已确认，并进入正式时间线。" : "候选事件已拒绝。原始资料仍然保留。");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "处理候选事件失败。 ");
    } finally {
      setBusy(false);
    }
  }

  const fragment = selectedArtifact?.revisions.at(-1)?.fragments[0];

  return (
    <div className="mx-auto max-w-[1440px] space-y-8">
      <PageHeader
        eyebrow="Archive Inbox"
        title="待整理档案"
        description="先保存原始资料，再从原始片段建立候选事件。只有你确认的事件才进入时间线。"
      />

      {(message || error) && (
        <div className={`border px-4 py-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
          {error ?? message}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <SectionCard title="保存原始文本" eyebrow="Raw Evidence" description="这一份原文只追加，不会被事件标题或后续整理结果覆盖。">
          <form className="space-y-4" onSubmit={handleCreateArtifact}>
            <Field label="资料标题">
              <input value={title} onChange={(event) => setTitle(event.target.value)} className={fieldClassName} placeholder="例如：2026 年 7 月工作记录" />
            </Field>
            <Field label="原始内容">
              <textarea required value={content} onChange={(event) => setContent(event.target.value)} className={`${fieldClassName} min-h-52`} placeholder="粘贴日记、聊天记录、项目回顾或其他原始文字。" />
            </Field>
            <Button type="submit" disabled={busy || !content.trim()}>{busy ? "保存中..." : "保存原始资料"}</Button>
          </form>
          <div className="my-6 border-t border-border" />
          <form className="space-y-3" onSubmit={handleUploadFile}>
            <div>
              <label htmlFor="archive-file" className="text-sm font-medium">上传历史文件</label>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">PDF、DOCX、TXT 或 Markdown，不超过 2 MB。原始文件与解析文本会作为两个 revision 保留。</p>
            </div>
            <input
              id="archive-file"
              type="file"
              accept=".pdf,.doc,.docx,.txt,.md,.markdown"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              className="block w-full border border-border bg-background p-2 text-sm"
            />
            <Button type="submit" variant="secondary" disabled={busy || !selectedFile}>
              {busy ? "上传中..." : "上传并保留原件"}
            </Button>
          </form>
        </SectionCard>

        <SectionCard title="最近原始资料" eyebrow="Artifacts" description={`${artifacts.length} 份资料；选择后可以建立候选事件。`}>
          <div className="space-y-2">
            {artifacts.length === 0 && <p className="text-sm text-muted-foreground">还没有原始资料。</p>}
            {artifacts.map((artifact) => (
              <button key={artifact.id} type="button" onClick={() => void handleSelectArtifact(artifact.id)} className={`w-full border px-4 py-3 text-left ${selectedArtifact?.id === artifact.id ? "border-emerald-300 bg-emerald-50" : "border-border bg-card"}`}>
                <p className="font-medium">{artifact.title || "未命名资料"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(artifact.createdAt)}</p>
              </button>
            ))}
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SectionCard title="从原始片段建立候选事件" eyebrow="Event Candidate" description="这里是手动整理入口，不调用第三方模型。">
          {!fragment ? (
            <p className="text-sm text-muted-foreground">先保存或选择一份原始资料。</p>
          ) : (
            <form className="space-y-4" onSubmit={handleCreateCandidate}>
              {selectedArtifact && <AskAssistantLink entityType="artifact" entityId={selectedArtifact.id} label="围绕这份原始资料提问" />}
              <blockquote className="max-h-36 overflow-auto border-l-2 border-emerald-300 bg-emerald-50/60 px-4 py-3 text-sm leading-6 text-muted-foreground">{fragment.content}</blockquote>
              <Field label="事件标题"><input required value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} className={fieldClassName} /></Field>
              <Field label="发生时间"><input required type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} className={fieldClassName} /></Field>
              <Field label="事件类型"><select value={eventType} onChange={(event) => setEventType(event.target.value as EventType)} className={fieldClassName}>{eventTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
              <Field label="补充说明"><textarea value={eventDescription} onChange={(event) => setEventDescription(event.target.value)} className={`${fieldClassName} min-h-24`} /></Field>
              <Button type="submit" disabled={busy || !eventTitle.trim() || !occurredAt}>加入待确认</Button>
            </form>
          )}
        </SectionCard>

        <SectionCard title="待确认事件" eyebrow="Human Gate" description="确认后会生成事件初始版本，并保留到原始片段的关系。">
          <div className="space-y-3">
            {candidates.length === 0 && <p className="text-sm text-muted-foreground">没有待确认事件。</p>}
            {candidates.map((candidate) => (
              <article key={candidate.id} className="border border-border bg-card p-4">
                <p className="font-medium">{candidate.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(candidate.occurredAt)} · {candidate.eventType}</p>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">来源：{candidate.evidenceFragment.content}</p>
                <div className="mt-4 flex gap-2">
                  <Button type="button" size="sm" disabled={busy} onClick={() => void handleReview(candidate, "confirmed")}>确认进入时间线</Button>
                  <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void handleReview(candidate, "rejected")}>拒绝</Button>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-2 text-sm font-medium"><span>{label}</span>{children}</label>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
