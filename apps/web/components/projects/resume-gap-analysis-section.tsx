"use client";

import { useCallback, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { SectionCard } from "@/components/shell/section-card";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api-client";
import {
  createResumeGapAnalysis,
  type ResumeGapAnalysis,
  type ResumeGapItem,
  type ResumeGapMatchedEvidence,
} from "@/lib/resume-gap-analysis";
import { cn } from "@/lib/utils";

type ActionState =
  | { type: "idle" }
  | { type: "success"; message: string; requestId?: string }
  | { type: "error"; message: string; requestId?: string };

type FormState = {
  targetRole: string;
  targetCompany: string;
  targetJobDescription: string;
};

const defaultFormState: FormState = {
  targetRole: "",
  targetCompany: "",
  targetJobDescription: "",
};

const evidenceTypeLabelMap: Record<ResumeGapMatchedEvidence["evidenceType"], string> = {
  resume_document: "简历原文",
  resume_material: "正式素材",
  project: "项目经历",
  ability_evidence: "能力证据",
  external_source: "外部来源",
};

const severityLabelMap: Record<ResumeGapItem["severity"], string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export function ResumeGapAnalysisSection() {
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [analysis, setAnalysis] = useState<ResumeGapAnalysis | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionState, setActionState] = useState<ActionState>({ type: "idle" });

  const matchedRequirementCount = useMemo(
    () => new Set(analysis?.matchedEvidence.map((item) => item.requirementId) ?? []).size,
    [analysis],
  );

  const handleFormChange = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((current) => ({
        ...current,
        [key]: value,
      }));
    },
    [],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const targetRole = form.targetRole.trim();
      if (!targetRole) {
        setActionState({
          type: "error",
          message: "请先填写目标岗位。",
        });
        return;
      }

      setIsSubmitting(true);
      setActionState({ type: "idle" });

      try {
        const response = await createResumeGapAnalysis({
          targetRole,
          targetCompany: normalizeOptionalText(form.targetCompany),
          targetJobDescription: normalizeOptionalText(form.targetJobDescription),
        });

        setAnalysis(response.data);
        setActionState({
          type: "success",
          message: "初步差距分析已生成。结果来自规则匹配，只能作为整理简历和补证据的参考。",
          requestId: response.requestId,
        });
      } catch (error) {
        setActionState({
          type: "error",
          message: error instanceof ApiClientError ? error.message : "生成差距分析失败，请稍后重试。",
          requestId: error instanceof ApiClientError ? error.requestId : undefined,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [form],
  );

  return (
    <SectionCard
      title="目标岗位差距分析"
      eyebrow="Resume Gap"
      description="把目标岗位或 JD 与已确认素材、项目经历、能力证据做一次初步匹配。当前是 deterministic 规则分析，不等同于真实 AI 或招聘方评价。"
      actions={
        <Button
          type="button"
          variant="ghost"
          disabled={isSubmitting}
          onClick={() => {
            setForm(defaultFormState);
            setAnalysis(null);
            setActionState({ type: "idle" });
          }}
        >
          清空
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-dashed border-white/10 bg-white/5 px-4 py-4 text-sm leading-6 text-muted-foreground">
          这个分析只读取当前资料，不写入正式档案。系统只会把
          <span className="font-medium text-foreground"> 已确认 </span>
          的简历素材和能力证据作为匹配依据，候选内容不会被当成正式能力。
        </div>

        {actionState.type !== "idle" ? <FeedbackBanner state={actionState} /> : null}

        <form className="space-y-4 rounded-lg border border-white/10 bg-background/40 p-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="resume-gap-target-role"
              label="目标岗位"
              value={form.targetRole}
              onChange={(value) => handleFormChange("targetRole", value)}
              placeholder="例如：AI 应用工程师"
            />
            <TextField
              id="resume-gap-target-company"
              label="目标公司（可选）"
              value={form.targetCompany}
              onChange={(value) => handleFormChange("targetCompany", value)}
              placeholder="例如：有培养体系的大公司"
            />
          </div>

          <TextAreaField
            id="resume-gap-target-jd"
            label="目标 JD / 岗位要求（可选）"
            value={form.targetJobDescription}
            onChange={(value) => handleFormChange("targetJobDescription", value)}
            placeholder="粘贴岗位要求。若为空，系统会根据目标岗位使用保守模板做初步判断。"
            minHeightClassName="min-h-36"
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "分析中..." : "生成差距分析"}
            </Button>
            <p className="text-xs leading-5 text-muted-foreground">
              第一版不联网、不调用真实模型，只做可解释的关键词和证据匹配。
            </p>
          </div>
        </form>

        {analysis ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/10 px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <MetaBadge text={`要求 ${analysis.requirementItems.length}`} tone="sky" />
                <MetaBadge text={`已匹配 ${matchedRequirementCount}`} tone="emerald" />
                <MetaBadge text={`缺口 ${analysis.gapItems.length}`} tone="amber" />
                <MetaBadge text="规则分析" tone="default" />
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{analysis.summary}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard label="简历原文" value={analysis.sourceSnapshot.resumeDocuments} />
              <StatCard label="正式素材" value={analysis.sourceSnapshot.confirmedResumeMaterials} />
              <StatCard label="项目经历" value={analysis.sourceSnapshot.projects} />
              <StatCard label="能力证据" value={analysis.sourceSnapshot.confirmedAbilityEvidence} />
              <StatCard label="外部来源" value={analysis.sourceSnapshot.externalSources} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)]">
              <ResultPanel title="岗位要求">
                {analysis.requirementItems.map((item) => (
                  <article key={item.id} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <MetaBadge text={item.source === "jd" ? "来自 JD" : "岗位模板"} tone="default" />
                      {item.keywords.slice(0, 4).map((keyword) => (
                        <MetaBadge key={keyword} text={keyword} tone="sky" />
                      ))}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-foreground">{item.text}</p>
                  </article>
                ))}
              </ResultPanel>

              <ResultPanel title="匹配证据">
                {analysis.matchedEvidence.length > 0 ? (
                  analysis.matchedEvidence.map((item) => (
                    <article key={`${item.requirementId}-${item.evidenceType}-${item.evidenceId}`} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <MetaBadge text={evidenceTypeLabelMap[item.evidenceType]} tone="emerald" />
                        {item.title ? <MetaBadge text={item.title} tone="default" /> : null}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.content}</p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        命中：{item.matchedKeywords.join(" / ")}
                      </p>
                    </article>
                  ))
                ) : (
                  <EmptyState text="当前已确认资料中暂未找到直接匹配证据。" />
                )}
              </ResultPanel>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <ResultPanel title="差距项">
                {analysis.gapItems.length > 0 ? (
                  analysis.gapItems.map((item) => (
                    <article key={item.requirementId} className="rounded-lg border border-amber-500/15 bg-amber-500/10 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <MetaBadge text={`严重度：${severityLabelMap[item.severity]}`} tone="amber" />
                        {item.missingKeywords.slice(0, 4).map((keyword) => (
                          <MetaBadge key={keyword} text={keyword} tone="default" />
                        ))}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-foreground">{item.requirementText}</p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.reason}</p>
                    </article>
                  ))
                ) : (
                  <EmptyState text="当前要求都找到了可追溯证据。仍建议人工检查表达质量与量化结果。" />
                )}
              </ResultPanel>

              <ResultPanel title="下一步建议">
                <div className="space-y-2">
                  {analysis.actionSuggestions.map((suggestion) => (
                    <div key={suggestion} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-foreground">
                      {suggestion}
                    </div>
                  ))}
                </div>
              </ResultPanel>
            </div>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}

function TextAreaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  minHeightClassName,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  minHeightClassName: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-lg border border-white/10 bg-background/50 px-4 py-3 text-sm leading-7 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20",
          minHeightClassName,
        )}
      />
    </div>
  );
}

function ResultPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-background/40 p-4">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-background/45 px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function MetaBadge({
  text,
  tone = "default",
}: {
  text: string;
  tone?: "default" | "emerald" | "sky" | "amber";
}) {
  const classNameMap = {
    default: "border-white/10 bg-background/50 text-muted-foreground",
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-foreground",
    sky: "border-sky-500/20 bg-sky-500/10 text-foreground",
    amber: "border-amber-500/20 bg-amber-500/10 text-foreground",
  } as const;

  return (
    <span className={cn("rounded-full border px-3 py-1 text-xs", classNameMap[tone])}>{text}</span>
  );
}

function FeedbackBanner({ state }: { state: Exclude<ActionState, { type: "idle" }> }) {
  const toneClassName =
    state.type === "success"
      ? "border-emerald-500/20 bg-emerald-500/10"
      : "border-rose-500/20 bg-rose-500/10";

  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm text-foreground", toneClassName)}>
      <p className="font-medium text-foreground">
        {state.type === "success" ? "操作成功" : "操作失败"}
      </p>
      <p className="mt-1 leading-6 text-muted-foreground">
        {state.message}
        {state.requestId ? `（requestId: ${state.requestId}）` : ""}
      </p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm leading-6 text-muted-foreground">
      {text}
    </div>
  );
}

function normalizeOptionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
