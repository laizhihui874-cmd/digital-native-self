"use client";

import type { FuturePlanStatus, GoalStatus, MilestoneStatus, PlanningTree } from "@digital-self/shared";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { AskAssistantLink } from "@/components/assistant/ask-assistant-link";
import { SectionCard } from "@/components/shell/section-card";
import { Button } from "@/components/ui/button";
import {
  createActionItem, createFuturePlan, createGoal, createMilestone, deleteActionItem,
  deleteFuturePlan, deleteGoal, deleteMilestone, getPlanningTree, updateActionItem,
  updateFuturePlan, updateGoal, updateMilestone,
} from "@/lib/planning";

type Draft = { title: string; date: string; extra?: string; milestoneId?: string };
const emptyDraft: Draft = { title: "", date: "" };

const goalLabels: Record<GoalStatus, string> = { draft: "草稿", active: "推进中", achieved: "已达成", paused: "暂停", abandoned: "已放下" };
const planLabels: Record<FuturePlanStatus, string> = { draft: "草稿", active: "进行中", completed: "已完成", paused: "暂停", abandoned: "已放下" };
const milestoneLabels: Record<MilestoneStatus, string> = { planned: "计划中", active: "推进中", completed: "已完成", missed: "已错过" };

export default function PlanningPage() {
  const [tree, setTree] = useState<PlanningTree>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [goalDraft, setGoalDraft] = useState({ title: "", area: "", targetDate: "", successCriteria: "" });
  const [planDrafts, setPlanDrafts] = useState<Record<string, Draft>>({});
  const [milestoneDrafts, setMilestoneDrafts] = useState<Record<string, Draft>>({});
  const [actionDrafts, setActionDrafts] = useState<Record<string, Draft>>({});

  const refresh = useCallback(async () => {
    const response = await getPlanningTree();
    setTree(response.data);
  }, []);
  useEffect(() => { refresh().catch((cause) => setError(messageOf(cause))).finally(() => setLoading(false)); }, [refresh]);

  async function run(task: () => Promise<unknown>, success: string) {
    setBusy(true); setError(undefined); setMessage(undefined);
    try { await task(); await refresh(); setMessage(success); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  }

  async function submitGoal(event: FormEvent) {
    event.preventDefault();
    if (!goalDraft.title.trim()) return;
    await run(() => createGoal({ title: goalDraft.title.trim(), area: optional(goalDraft.area), successCriteria: optional(goalDraft.successCriteria), targetDate: dateIso(goalDraft.targetDate), status: "active" }), "目标已加入指南针和人生星图。");
    setGoalDraft({ title: "", area: "", targetDate: "", successCriteria: "" });
  }

  const counts = useMemo(() => ({
    goals: tree.length,
    plans: tree.reduce((sum, goal) => sum + goal.plans.length, 0),
    openActions: tree.flatMap((goal) => goal.plans).flatMap((plan) => plan.actionItems).filter((item) => item.status !== "done" && item.status !== "cancelled").length,
  }), [tree]);

  return (
    <div className="mx-auto max-w-[1240px] space-y-8">
      <PageHeader eyebrow="Life Compass" title="未来指南针" description="目标说明要去哪里，计划说明怎么走，里程碑说明何时检查，行动项说明现在做什么。未来安排不会混进已发生的记忆。" />
      {(error || message) && <p className={`border px-4 py-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>{error ?? message}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="目标" value={counts.goals} />
        <Metric label="计划" value={counts.plans} />
        <Metric label="待行动" value={counts.openActions} />
      </div>

      <SectionCard title="写下一个目标" eyebrow="Goal" description="先写方向和判断达成的标准，计划可以随后补充。">
        <form onSubmit={(event) => void submitGoal(event)} className="grid gap-3 md:grid-cols-2">
          <Field label="目标名称"><input required aria-label="目标名称" value={goalDraft.title} onChange={(event) => setGoalDraft({ ...goalDraft, title: event.target.value })} className={inputClass} placeholder="例如：建立可以持续十年的个人档案系统" /></Field>
          <Field label="人生领域"><input aria-label="人生领域" value={goalDraft.area} onChange={(event) => setGoalDraft({ ...goalDraft, area: event.target.value })} className={inputClass} placeholder="工作、关系、健康、学习……" /></Field>
          <Field label="希望完成日期"><input aria-label="希望完成日期" type="date" value={goalDraft.targetDate} onChange={(event) => setGoalDraft({ ...goalDraft, targetDate: event.target.value })} className={inputClass} /></Field>
          <Field label="怎样算达成"><input aria-label="怎样算达成" value={goalDraft.successCriteria} onChange={(event) => setGoalDraft({ ...goalDraft, successCriteria: event.target.value })} className={inputClass} placeholder="写一个能检查的结果" /></Field>
          <Button disabled={busy || !goalDraft.title.trim()} className="md:col-span-2 md:w-fit">加入指南针</Button>
        </form>
      </SectionCard>

      <section className="space-y-5">
        {loading && <p className="text-sm text-muted-foreground">正在读取未来规划…</p>}
        {!loading && tree.length === 0 && <p className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">还没有目标。可以先写一个你愿意持续检查的方向。</p>}
        {tree.map((goal) => (
          <article key={goal.id} className="border border-border bg-card shadow-panel">
            <header className="grid gap-4 border-b border-border bg-emerald-50/60 p-5 md:grid-cols-[1fr_auto] dark:bg-emerald-500/5">
              <div><p className="text-xs text-emerald-700">{goal.area || "未分类"}{goal.targetDate ? ` · 希望 ${formatDate(goal.targetDate)} 前完成` : ""}</p><h2 className="mt-2 text-xl font-semibold">{goal.title}</h2>{goal.successCriteria && <p className="mt-2 text-sm text-muted-foreground">达成标准：{goal.successCriteria}</p>}</div>
              <div className="flex flex-wrap items-start gap-2"><AskAssistantLink entityType="goal" entityId={goal.id} label="指南针问题" /><StatusSelect ariaLabel={`目标“${goal.title}”状态`} value={goal.status} labels={goalLabels} onChange={(status) => void run(() => updateGoal(goal.id, { status: status as GoalStatus }), "目标状态已更新。")}/><button type="button" disabled={busy} onClick={() => void run(() => deleteGoal(goal.id), "目标及其下属计划已删除。") } className="px-2 py-2 text-xs text-rose-700 underline">删除</button></div>
            </header>
            <div className="space-y-4 p-5">
              {goal.plans.map((plan) => (
                <div key={plan.id} className="border border-border bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{plan.title}</h3><p className="mt-1 text-xs text-muted-foreground">{plan.startDate ? formatDate(plan.startDate) : "未定开始"} — {plan.endDate ? formatDate(plan.endDate) : "未定结束"}</p></div><div className="flex flex-wrap gap-2"><AskAssistantLink entityType="plan" entityId={plan.id} label="询问这条路径" /><StatusSelect ariaLabel={`计划“${plan.title}”状态`} value={plan.status} labels={planLabels} onChange={(status) => void run(() => updateFuturePlan(plan.id, { status: status as FuturePlanStatus }), "计划状态已更新。")}/><button type="button" onClick={() => void run(() => deleteFuturePlan(plan.id), "计划已删除。") } className="text-xs text-rose-700 underline">删除</button></div></div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div><p className="text-xs font-medium">里程碑</p><ul className="mt-2 space-y-2">{plan.milestones.map((item) => <li key={item.id} className="flex items-center gap-2 border border-border/70 px-3 py-2 text-sm"><StatusSelect compact ariaLabel={`里程碑“${item.title}”状态`} value={item.status} labels={milestoneLabels} onChange={(status) => void run(() => updateMilestone(item.id, { status: status as MilestoneStatus }), "里程碑状态已更新。")}/><span className="min-w-0 flex-1">{item.title}{item.dueAt ? <small className="ml-2 text-muted-foreground">{formatDate(item.dueAt)}</small> : null}</span><button type="button" onClick={() => void run(() => deleteMilestone(item.id), "里程碑已删除。") } className="text-xs text-rose-700">删除</button></li>)}</ul><InlineCreate label="新增里程碑" draft={milestoneDrafts[plan.id] ?? emptyDraft} onChange={(draft) => setMilestoneDrafts({ ...milestoneDrafts, [plan.id]: draft })} onSubmit={() => void run(() => createMilestone(plan.id, { title: milestoneDrafts[plan.id]?.title.trim() ?? "", dueAt: dateIso(milestoneDrafts[plan.id]?.date), status: "planned" }).then(() => setMilestoneDrafts({ ...milestoneDrafts, [plan.id]: emptyDraft })), "里程碑已加入计划。")}/></div>
                    <div><p className="text-xs font-medium">行动项</p><ul className="mt-2 space-y-2">{plan.actionItems.map((item) => <li key={item.id} className="flex items-center gap-2 border border-border/70 px-3 py-2 text-sm"><input aria-label={`完成行动“${item.title}”`} type="checkbox" checked={item.status === "done"} onChange={(event) => void run(() => updateActionItem(item.id, { status: event.target.checked ? "done" : "todo" }), "行动状态已更新。")}/><span className={`min-w-0 flex-1 ${item.status === "done" ? "line-through text-muted-foreground" : ""}`}>{item.title}{item.dueAt ? <small className="ml-2 text-muted-foreground">{formatDate(item.dueAt)}</small> : null}</span><button type="button" onClick={() => void run(() => deleteActionItem(item.id), "行动项已删除。") } className="text-xs text-rose-700">删除</button></li>)}</ul><InlineCreate label="新增行动" draft={actionDrafts[plan.id] ?? emptyDraft} milestones={plan.milestones.map((item) => ({ id: item.id, title: item.title }))} onChange={(draft) => setActionDrafts({ ...actionDrafts, [plan.id]: draft })} onSubmit={() => void run(() => createActionItem(plan.id, { title: actionDrafts[plan.id]?.title.trim() ?? "", dueAt: dateIso(actionDrafts[plan.id]?.date), milestoneId: optional(actionDrafts[plan.id]?.milestoneId), status: "todo" }).then(() => setActionDrafts({ ...actionDrafts, [plan.id]: emptyDraft })), "行动项已加入计划。")}/></div>
                  </div>
                </div>
              ))}
              <InlineCreate label="给这个目标添加计划" draft={planDrafts[goal.id] ?? emptyDraft} dateLabel="结束日期" onChange={(draft) => setPlanDrafts({ ...planDrafts, [goal.id]: draft })} onSubmit={() => void run(() => createFuturePlan(goal.id, { title: planDrafts[goal.id]?.title.trim() ?? "", endDate: dateIso(planDrafts[goal.id]?.date), status: "active" }).then(() => setPlanDrafts({ ...planDrafts, [goal.id]: emptyDraft })), "计划已加入目标。")}/>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

const inputClass = "h-10 w-full border border-input bg-background px-3 text-sm outline-none focus:border-emerald-500";
function Metric({ label, value }: { label: string; value: number }) { return <div className="border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1 text-xs text-muted-foreground">{label}{children}</label>; }
function StatusSelect({ value, labels, onChange, ariaLabel, compact }: { value: string; labels: Record<string, string>; onChange: (value: string) => void; ariaLabel: string; compact?: boolean }) { return <select aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value)} className={`border border-input bg-background px-2 text-xs ${compact ? "h-8" : "h-9"}`}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>; }
function InlineCreate({ label, draft, onChange, onSubmit, dateLabel = "日期", milestones }: { label: string; draft: Draft; onChange: (draft: Draft) => void; onSubmit: () => void; dateLabel?: string; milestones?: Array<{ id: string; title: string }> }) { return <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_140px_auto]"><input aria-label={`${label}名称`} value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} className={inputClass} placeholder={label}/><input aria-label={`${label}${dateLabel}`} type="date" value={draft.date} onChange={(event) => onChange({ ...draft, date: event.target.value })} className={inputClass}/>{milestones && <select aria-label={`${label}所属里程碑`} value={draft.milestoneId ?? ""} onChange={(event) => onChange({ ...draft, milestoneId: event.target.value })} className={`${inputClass} sm:col-span-2`}><option value="">直接属于计划</option>{milestones.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>}<button type="button" disabled={!draft.title.trim()} onClick={onSubmit} className="bg-foreground px-3 py-2 text-xs text-background disabled:opacity-40">添加</button></div>; }
function optional(value?: string) { return value?.trim() || undefined; }
function dateIso(value?: string) { return value ? `${value}T00:00:00.000Z` : undefined; }
function formatDate(value: string) { return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value)); }
function messageOf(cause: unknown) { return cause instanceof Error ? cause.message : "操作失败，请稍后重试。"; }
