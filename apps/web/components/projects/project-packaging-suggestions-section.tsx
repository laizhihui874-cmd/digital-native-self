"use client";

import { useCallback, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { SectionCard } from "@/components/shell/section-card";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api-client";
import {
  createProjectPackagingSuggestions,
  type ProjectPackagingSuggestionEvidenceItem,
  type ProjectPackagingSuggestionItem,
  type ProjectPackagingSuggestions,
} from "@/lib/project-packaging-suggestions";
import { type Project } from "@/lib/projects";
import { cn } from "@/lib/utils";

type ActionState =
  | { type: "idle" }
  | { type: "success"; message: string; requestId?: string }
  | { type: "error"; message: string; requestId?: string };

type FormState = {
  targetRole: string;
  targetCompany: string;
  targetJobDescription: string;
  projectId: string;
};

const defaultFormState: FormState = {
  targetRole: "",
  targetCompany: "",
  targetJobDescription: "",
  projectId: "",
};

const categoryLabelMap: Record<ProjectPackagingSuggestionItem["category"], string> = {
  project_title: "项目标题",
  resume_star: "STAR 草稿",
  quantified_outcome: "量化成果",
  ability_mapping: "能力映射",
  gap_alert: "缺口提醒",
};

const evidenceTypeLabelMap: Record<ProjectPackagingSuggestionEvidenceItem["evidenceType"], string> = {
  project: "项目",
  resume_material: "正式素材",
  ability_evidence: "能力证据",
};

export function ProjectPackagingSuggestionsSection({
  projects,
}: {
  projects: Project[];
}) {
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [analysis, setAnalysis] = useState<ProjectPackagingSuggestions | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionState, setActionState] = useState<ActionState>({ type: "idle" });

  const selectedProjectName = useMemo(() => {
    if (!form.projectId) {
      return "未指定";
    }

    return projects.find((item) => item.id === form.projectId)?.name ?? "未指定";
  }, [form.projectId, projects]);

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
        const response = await createProjectPackagingSuggestions({
          targetRole,
          targetCompany: normalizeOptionalText(form.targetCompany),
          targetJobDescription: normalizeOptionalText(form.targetJobDescription),
          projectId: normalizeOptionalText(form.projectId),
        });

        setAnalysis(response.data);
        setActionState({
          type: "success",
          message:
            "项目包装建议已生成。结果只是一版 deterministic 草稿，必须由你确认后再写入简历或正式档案。",
          requestId: response.requestId,
        });
      } catch (error) {
        setActionState({
          type: "error",
          message: error instanceof ApiClientError ? error.message : "生成项目包装建议失败，请稍后重试。",
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
      title="项目包装建议"
      eyebrow="Project Packaging"
      description="把已确认的项目、正式简历素材和能力证据整理成一版简历友好的项目表达建议。当前只做 deterministic first-pass suggestion，不代表正式 AI 招聘判断。"
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
          建议仅为草稿，需用户确认后再写入简历或正式档案。系统只读取
          <span className="font-medium text-foreground"> 已确认 </span>
          的 ResumeMaterial、AbilityEvidence 和 Project，不会把 candidate 内容当成正式证据。
        </div>

        {actionState.type !== "idle" ? <FeedbackBanner state={actionState} /> : null}

        <form className="space-y-4 rounded-lg border border-white/10 bg-background/40 p-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="project-packaging-target-role"
              label="目标岗位"
              value={form.targetRole}
              onChange={(value) => handleFormChange("targetRole", value)}
              placeholder="例如：AI 应用工程师"
            />
            <TextField
              id="project-packaging-target-company"
              label="目标公司（可选）"
              value={form.targetCompany}
              onChange={(value) => handleFormChange("targetCompany", value)}
              placeholder="例如：B 端 AI 产品团队"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="project-packaging-project">
              选择项目（可选）
            </label>
            <select
              id="project-packaging-project"
              value={form.projectId}
              onChange={(event) => handleFormChange("projectId", event.target.value)}
              className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
            >
              <option value="">不指定，按最近项目做泛化建议</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <p className="text-xs leading-5 text-muted-foreground">当前选择：{selectedProjectName}</p>
          </div>

          <TextAreaField
            id="project-packaging-target-jd"
            label="目标 JD / 项目表达目标（可选）"
            value={form.targetJobDescription}
            onChange={(value) => handleFormChange("targetJobDescription", value)}
            placeholder="粘贴岗位要求，或补充你希望项目重点强调的方向。若为空，系统只按目标岗位做保守整理。"
            minHeightClassName="min-h-32"
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "生成中..." : "生成项目包装建议"}
            </Button>
            <p className="text-xs leading-5 text-muted-foreground">
              第一版不会虚构结果，只会回填现有正式证据并提示你补量化口径。
            </p>
          </div>
        </form>

        {analysis ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/10 px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <MetaBadge text={`建议 ${analysis.suggestionItems.length}`} tone="emerald" />
                <MetaBadge
                  text={
                    analysis.evidenceSnapshot.selectedProject
                      ? `项目：${analysis.evidenceSnapshot.selectedProject.name}`
                      : "未指定项目"
                  }
                  tone="sky"
                />
                <MetaBadge text="规则分析" tone="default" />
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{analysis.summary}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="正式素材" value={analysis.sourceSnapshot.confirmedResumeMaterials} />
              <StatCard label="能力证据" value={analysis.sourceSnapshot.confirmedAbilityEvidence} />
              <StatCard label="可选项目" value={analysis.sourceSnapshot.availableProjects} />
            </div>

            <ResultPanel title="建议列表">
              {analysis.suggestionItems.map((item) => (
                <article key={item.id} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <MetaBadge text={categoryLabelMap[item.category]} tone="emerald" />
                    <MetaBadge text={item.label} tone="default" />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-foreground">{item.suggestion}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.rationale}</p>
                  {item.evidenceItems.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.evidenceItems.map((evidence) => (
                        <MetaBadge
                          key={`${item.id}-${evidence.evidenceType}-${evidence.evidenceId}`}
                          text={`${evidenceTypeLabelMap[evidence.evidenceType]}${evidence.title ? `：${evidence.title}` : ""}`}
                          tone="sky"
                        />
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </ResultPanel>

            <div className="grid gap-4 xl:grid-cols-2">
              <ResultPanel title="证据快照">
                <div className="space-y-3">
                  {analysis.evidenceSnapshot.selectedProject ? (
                    <article className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <MetaBadge text="项目" tone="emerald" />
                        <MetaBadge text={analysis.evidenceSnapshot.selectedProject.name} tone="default" />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {[
                          analysis.evidenceSnapshot.selectedProject.role,
                          analysis.evidenceSnapshot.selectedProject.resumeSummary,
                          ...analysis.evidenceSnapshot.selectedProject.outcomes,
                        ]
                          .filter(Boolean)
                          .join(" / ") || "当前项目缺少更多可展示字段。"}
                      </p>
                    </article>
                  ) : (
                    <EmptyState text="当前没有锁定单个项目，建议会偏泛化。" />
                  )}

                  {analysis.evidenceSnapshot.confirmedResumeMaterials.map((item) => (
                    <article key={item.id} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <MetaBadge text="正式素材" tone="sky" />
                        <MetaBadge text={item.materialType} tone="default" />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {item.suggestedBullet ?? item.content}
                      </p>
                    </article>
                  ))}
                </div>
              </ResultPanel>

              <ResultPanel title="能力映射来源">
                {analysis.evidenceSnapshot.confirmedAbilityEvidence.length > 0 ? (
                  analysis.evidenceSnapshot.confirmedAbilityEvidence.map((item) => (
                    <article key={item.id} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <MetaBadge text="能力证据" tone="amber" />
                        <MetaBadge text={item.abilityName} tone="default" />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.content}</p>
                    </article>
                  ))
                ) : (
                  <EmptyState text="当前没有已确认能力证据可映射到项目表达。" />
                )}
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
