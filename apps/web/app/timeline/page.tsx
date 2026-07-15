"use client";

import type { EventDetail, Person } from "@digital-self/shared";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { AskAssistantLink } from "@/components/assistant/ask-assistant-link";
import { SectionCard } from "@/components/shell/section-card";
import { createEventParticipant, createMemoryCandidateFromEvent, deleteEventParticipant, listEvents } from "@/lib/archive";
import { listPeople } from "@/lib/people";

type ParticipantDraft = { personId: string; role: string };

export default function TimelinePage() {
  const [events, setEvents] = useState<EventDetail[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [memoryDrafts, setMemoryDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [savingEventId, setSavingEventId] = useState<string | null>(null);
  const [participantDrafts, setParticipantDrafts] = useState<Record<string, ParticipantDraft>>({});
  const [savingParticipantEventId, setSavingParticipantEventId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listEvents(), listPeople()])
      .then(([eventResult, peopleResult]) => {
        setEvents(eventResult.data.items);
        setPeople(peopleResult.data);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "读取时间线失败。"))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreateMemoryCandidate(event: EventDetail) {
    const content = memoryDrafts[event.id]?.trim();
    if (!content) return;
    setSavingEventId(event.id);
    setError(null);
    try {
      await createMemoryCandidateFromEvent(event.id, {
        content,
        memoryType: "value",
      });
      setMemoryDrafts((current) => ({ ...current, [event.id]: "" }));
      setMessage("候选长期记忆已生成，需要你去长期记忆页确认。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建候选记忆失败。");
    } finally {
      setSavingEventId(null);
    }
  }

  async function refreshEvents() {
    const result = await listEvents();
    setEvents(result.data.items);
  }

  async function handleAddParticipant(event: EventDetail) {
    const draft = participantDrafts[event.id];
    if (!draft?.personId) return;
    setSavingParticipantEventId(event.id);
    setError(null);
    try {
      await createEventParticipant(event.id, {
        personId: draft.personId,
        role: draft.role.trim() || undefined,
        evidenceFragmentId: event.sources[0]?.evidenceFragmentId,
        validFrom: event.occurredAt,
        validTo: event.endedAt ?? undefined,
      });
      await refreshEvents();
      setParticipantDrafts((current) => ({ ...current, [event.id]: { personId: "", role: "" } }));
      setMessage("人物与事件已经连到人生星图，并保留了这条事件的来源片段。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "关联人物失败。");
    } finally {
      setSavingParticipantEventId(null);
    }
  }

  async function handleDeleteParticipant(id: string) {
    setError(null);
    try {
      await deleteEventParticipant(id);
      await refreshEvents();
      setMessage("人物与事件的参与记录已移除。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "移除参与记录失败。");
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-8">
      <PageHeader eyebrow="Life Timeline" title="人生时间线" description="只展示已经确认的事件。每条新档案事件都可以回到原始资料和历史版本。" />
      {message && <p className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</p>}
      <SectionCard title="已确认事件" eyebrow="Confirmed Events" description={`${events.length} 条事件`}>
        {loading && <p className="text-sm text-muted-foreground">正在读取时间线...</p>}
        {error && <p className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</p>}
        {!loading && !error && events.length === 0 && <p className="text-sm text-muted-foreground">时间线还没有确认事件。可以先去“待整理档案”保存资料并确认事件。</p>}
        <ol className="relative space-y-5 border-l border-emerald-200 pl-7">
          {events.map((event) => (
            <li key={event.id} className="relative">
              <span className="absolute -left-[33px] top-2 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
              <article className="border border-border bg-card p-5">
                <p className="text-xs font-medium text-emerald-700">{formatDate(event.occurredAt)} · {precisionLabel(event.timePrecision)}</p>
                <h2 className="mt-2 text-xl font-semibold">{event.title}</h2>
                <AskAssistantLink entityType="event" entityId={event.id} className="mt-3" label="围绕这件事提问" />
                {event.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{event.description}</p>}
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="border border-border/70 bg-muted/30 p-3 text-sm">
                    <p className="font-medium">原始来源</p>
                    <p className="mt-2 line-clamp-4 leading-6 text-muted-foreground">{event.sources[0]?.evidenceFragment.content ?? "这条旧事件还没有精确来源片段。"}</p>
                  </div>
                  <div className="border border-border/70 bg-muted/30 p-3 text-sm">
                    <p className="font-medium">版本历史</p>
                    <p className="mt-2 text-muted-foreground">{event.revisions.length > 0 ? `${event.revisions.length} 个版本，最早版本保留于 ${formatDate(event.revisions[0].createdAt)}` : "这条旧事件还没有版本快照。"}</p>
                  </div>
                </div>
                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-sm font-medium">参与这件事的人</p>
                  {event.participants.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {event.participants.map((participant) => (
                        <li key={participant.id} className="inline-flex items-center gap-2 border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-950">
                          <span>{people.find((person) => person.id === participant.personId)?.name ?? "未命名人物"}{participant.role ? ` · ${participant.role}` : ""}</span>
                          <button type="button" onClick={() => void handleDeleteParticipant(participant.id)} className="text-amber-800 underline underline-offset-2">移除</button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">还没有人物参与记录。</p>
                  )}
                  {people.length > 0 ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(150px,0.8fr)_minmax(160px,1fr)_auto]">
                      <label className="grid gap-1 text-xs text-muted-foreground">
                        人物
                        <select
                          aria-label={`为事件“${event.title}”选择参与人物`}
                          value={participantDrafts[event.id]?.personId ?? ""}
                          onChange={(inputEvent) => setParticipantDrafts((current) => ({ ...current, [event.id]: { personId: inputEvent.target.value, role: current[event.id]?.role ?? "" } }))}
                          className="h-10 border border-border bg-background px-3 text-sm text-foreground"
                        >
                          <option value="">请选择</option>
                          {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs text-muted-foreground">
                        在事件中的角色
                        <input
                          aria-label={`人物在事件“${event.title}”中的角色`}
                          value={participantDrafts[event.id]?.role ?? ""}
                          onChange={(inputEvent) => setParticipantDrafts((current) => ({ ...current, [event.id]: { personId: current[event.id]?.personId ?? "", role: inputEvent.target.value } }))}
                          className="h-10 border border-border bg-background px-3 text-sm text-foreground"
                          placeholder="例如：共同创作者"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={savingParticipantEventId === event.id || !participantDrafts[event.id]?.personId}
                        onClick={() => void handleAddParticipant(event)}
                        className="self-end bg-amber-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {savingParticipantEventId === event.id ? "关联中..." : "关联人物"}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">先去“人物档案”添加人物，再回来建立参与记录。</p>
                  )}
                </div>
                {event.sources.length > 0 && (
                  <div className="mt-4 border-t border-border pt-4">
                    <label className="text-sm font-medium" htmlFor={`memory-${event.id}`}>候选长期记忆</label>
                    <p className="mt-1 text-xs text-muted-foreground">把这次经历中希望未来记住的认识写下来。它会先进入候选列表。
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        id={`memory-${event.id}`}
                        value={memoryDrafts[event.id] ?? ""}
                        onChange={(inputEvent) =>
                          setMemoryDrafts((current) => ({ ...current, [event.id]: inputEvent.target.value }))
                        }
                        className="min-w-0 flex-1 border border-border bg-background px-3 py-2 text-sm outline-none focus:border-emerald-500"
                        placeholder="例如：我在这次经历中发现……"
                      />
                      <button
                        type="button"
                        disabled={savingEventId === event.id || !memoryDrafts[event.id]?.trim()}
                        onClick={() => void handleCreateMemoryCandidate(event)}
                        className="bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {savingEventId === event.id ? "保存中..." : "加入候选记忆"}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            </li>
          ))}
        </ol>
      </SectionCard>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "long", timeStyle: "short" }).format(new Date(value));
}

function precisionLabel(value: EventDetail["timePrecision"]) {
  return ({ exact: "精确时间", day: "按天记录", month: "按月记录", year: "按年记录", approximate: "大约时间", unknown: "时间精度未知" } as const)[value];
}
