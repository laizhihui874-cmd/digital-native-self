"use client";

import type { Person } from "@digital-self/shared";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { AskAssistantLink } from "@/components/assistant/ask-assistant-link";
import { SectionCard } from "@/components/shell/section-card";
import { Button } from "@/components/ui/button";
import { createPerson, deletePerson, listPeople } from "@/lib/people";

const fieldClass = "h-10 w-full border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary";

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [description, setDescription] = useState("");
  const [firstMetAt, setFirstMetAt] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => setPeople((await listPeople()).data), []);
  useEffect(() => { refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "读取人物失败。")); }, [refresh]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(undefined); setMessage(undefined);
    try {
      await createPerson({ name, relationship: relationship.trim() || undefined, description: description.trim() || undefined, firstMetAt: firstMetAt ? `${firstMetAt}T00:00:00.000Z` : undefined });
      setName(""); setRelationship(""); setDescription(""); setFirstMetAt(""); setMessage("人物已加入人生档案和星图。"); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存人物失败。"); } finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-[1200px] space-y-8">
    <PageHeader eyebrow="People" title="人生人物" description="记录重要人物，再到人生星图中连接共同事件、记忆、项目与决定。" />
    {(message || error) && <div className={`border px-4 py-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>{error ?? message}</div>}
    <section className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <SectionCard title="记录人物" eyebrow="Add Person" description="只写对你有用的信息，不需要补齐隐私资料。">
        <form className="space-y-3" onSubmit={submit}>
          <Field label="姓名或称呼"><input required value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} /></Field>
          <Field label="与你的关系"><input value={relationship} onChange={(event) => setRelationship(event.target.value)} placeholder="朋友、同事、家人、导师…" className={fieldClass} /></Field>
          <Field label="初次相识日期"><input type="date" value={firstMetAt} onChange={(event) => setFirstMetAt(event.target.value)} className={fieldClass} /></Field>
          <Field label="说明"><textarea value={description} onChange={(event) => setDescription(event.target.value)} className={`${fieldClass} h-28 py-2`} /></Field>
          <Button type="submit" disabled={busy || !name.trim()}>{busy ? "保存中…" : "加入人物档案"}</Button>
        </form>
      </SectionCard>
      <SectionCard title="已记录人物" eyebrow="People Archive" description={`${people.length} 位人物`}>
        {people.length === 0 ? <p className="text-sm text-muted-foreground">还没有人物记录。</p> : <div className="grid gap-3 md:grid-cols-2">{people.map((person) => <article key={person.id} className="border border-border p-4">
          <h2 className="font-medium">{person.name}</h2><p className="mt-1 text-xs text-muted-foreground">{person.relationship || "关系未填写"}</p>
          {person.description && <p className="mt-3 text-sm leading-6 text-muted-foreground">{person.description}</p>}
          <div className="mt-4 flex flex-wrap gap-2"><AskAssistantLink entityType="person" entityId={person.id} label="围绕这个人提问" /><Button type="button" size="sm" variant="secondary" onClick={() => void deletePerson(person.id).then(refresh)}>删除</Button></div>
        </article>)}</div>}
      </SectionCard>
    </section>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1 text-xs text-muted-foreground">{label}{children}</label>; }
