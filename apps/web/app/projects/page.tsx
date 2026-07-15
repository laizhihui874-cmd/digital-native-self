"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { ResumeDocumentsSection } from "@/components/projects/resume-documents-section";
import { ResumeGapAnalysisSection } from "@/components/projects/resume-gap-analysis-section";
import { ResumeMaterialsSection } from "@/components/projects/resume-materials-section";
import { ProjectPackagingSuggestionsSection } from "@/components/projects/project-packaging-suggestions-section";
import { PageHeader } from "@/components/shell/page-header";
import { SectionCard } from "@/components/shell/section-card";
import { Button } from "@/components/ui/button";
import { type AbilityEvidence, listAbilityEvidence } from "@/lib/ability-evidence";
import { ApiClientError } from "@/lib/api-client";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  projectStatusValues,
  updateProject,
  type Project,
  type ProjectDetail,
  type ProjectStatus,
} from "@/lib/projects";
import { cn } from "@/lib/utils";

const listLimit = 50;
const evidenceLimit = 100;

const projectStatusLabelMap: Record<ProjectStatus, string> = {
  planned: "规划中",
  active: "进行中",
  completed: "已完成",
  archived: "已归档",
};

const filterOptions = ["all", ...projectStatusValues] as const;
type ProjectFilter = (typeof filterOptions)[number];

type ActionState =
  | { type: "idle" }
  | { type: "success"; message: string; requestId?: string }
  | { type: "error"; message: string; requestId?: string };

type FormState = {
  name: string;
  description: string;
  role: string;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  outcomesText: string;
  resumeSummary: string;
  abilityEvidenceIds: string[];
};

const defaultFormState: FormState = {
  name: "",
  description: "",
  role: "",
  startDate: "",
  endDate: "",
  status: "active",
  outcomesText: "",
  resumeSummary: "",
  abilityEvidenceIds: [],
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<ProjectFilter>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
  const [createForm, setCreateForm] = useState<FormState>(defaultFormState);
  const [editForm, setEditForm] = useState<FormState>(defaultFormState);
  const [confirmedEvidence, setConfirmedEvidence] = useState<AbilityEvidence[]>([]);
  const [isListLoading, setIsListLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isEvidenceLoading, setIsEvidenceLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>({ type: "idle" });

  const selectedProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedProjectIdRef.current = selectedProjectId;
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProject) {
      setEditForm(defaultFormState);
      return;
    }

    setEditForm({
      name: selectedProject.name,
      description: selectedProject.description ?? "",
      role: selectedProject.role ?? "",
      startDate: toDateInputValue(selectedProject.startDate),
      endDate: toDateInputValue(selectedProject.endDate),
      status: selectedProject.status,
      outcomesText: selectedProject.outcomes.join("\n"),
      resumeSummary: selectedProject.resumeSummary ?? "",
      abilityEvidenceIds: selectedProject.abilityEvidenceItems.map((item) => item.id),
    });
  }, [selectedProject]);

  const loadProjectsList = useCallback(
    async (filter: ProjectFilter, preferredId?: string | null) => {
      setIsListLoading(true);
      setListError(null);

      try {
        const response = await listProjects({
          status: filter === "all" ? undefined : filter,
          limit: listLimit,
          offset: 0,
        });

        const items = response.data.items;
        setProjects(items);
        setTotal(response.data.pagination.total);

        const fallbackSelectedId =
          preferredId !== undefined ? preferredId : selectedProjectIdRef.current;
        const nextSelectedId =
          fallbackSelectedId && items.some((item) => item.id === fallbackSelectedId)
            ? fallbackSelectedId
            : items[0]?.id ?? null;

        setSelectedProjectId(nextSelectedId);

        if (!nextSelectedId) {
          setSelectedProject(null);
          setDetailError(null);
        }
      } catch (error) {
        const message =
          error instanceof ApiClientError
            ? `${error.message}${error.requestId ? `（requestId: ${error.requestId}）` : ""}`
            : "当前无法读取项目列表，请确认后端服务已启动。";

        setProjects([]);
        setTotal(0);
        setSelectedProjectId(null);
        setSelectedProject(null);
        setListError(message);
      } finally {
        setIsListLoading(false);
      }
    },
    [],
  );

  const loadProjectDetail = useCallback(async (projectId: string) => {
    setIsDetailLoading(true);
    setDetailError(null);

    try {
      const response = await getProject(projectId);

      if (selectedProjectIdRef.current === projectId) {
        setSelectedProject(response.data);
      }
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? `${error.message}${error.requestId ? `（requestId: ${error.requestId}）` : ""}`
          : "当前无法读取项目详情，请稍后重试。";

      if (selectedProjectIdRef.current === projectId) {
        setSelectedProject(null);
        setDetailError(message);
      }
    } finally {
      if (selectedProjectIdRef.current === projectId) {
        setIsDetailLoading(false);
      }
    }
  }, []);

  const loadConfirmedEvidence = useCallback(async () => {
    setIsEvidenceLoading(true);
    setEvidenceError(null);

    try {
      const response = await listAbilityEvidence({
        status: "confirmed",
        limit: evidenceLimit,
        offset: 0,
      });
      setConfirmedEvidence(response.data.items);
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? `${error.message}${error.requestId ? `（requestId: ${error.requestId}）` : ""}`
          : "当前无法读取已确认能力证据，请稍后重试。";
      setConfirmedEvidence([]);
      setEvidenceError(message);
    } finally {
      setIsEvidenceLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjectsList(statusFilter);
  }, [loadProjectsList, statusFilter]);

  useEffect(() => {
    void loadConfirmedEvidence();
  }, [loadConfirmedEvidence]);

  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedProject(null);
      setDetailError(null);
      setIsDetailLoading(false);
      return;
    }

    void loadProjectDetail(selectedProjectId);
  }, [loadProjectDetail, selectedProjectId]);

  const selectedProjectSummary = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const selectedEvidenceCount = selectedProject?.abilityEvidenceItems.length ?? 0;
  const completedCount = useMemo(
    () => projects.filter((project) => project.status === "completed").length,
    [projects],
  );
  const archivedCount = useMemo(
    () => projects.filter((project) => project.status === "archived").length,
    [projects],
  );

  const handleCreateFormChange = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setCreateForm((current) => ({
        ...current,
        [key]: value,
      }));
    },
    [],
  );

  const handleEditFormChange = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setEditForm((current) => ({
        ...current,
        [key]: value,
      }));
    },
    [],
  );

  const handleSelectProject = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    setActionState({ type: "idle" });
  }, []);

  const handleCreateProject = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const name = createForm.name.trim();

      if (!name) {
        setActionState({
          type: "error",
          message: "请先填写项目名称。",
        });
        return;
      }

      const dateRangeError = validateDateRange(createForm.startDate, createForm.endDate);
      if (dateRangeError) {
        setActionState({ type: "error", message: dateRangeError });
        return;
      }

      setIsCreating(true);
      setActionState({ type: "idle" });

      try {
        const response = await createProject({
          name,
          description: normalizeOptionalText(createForm.description),
          role: normalizeOptionalText(createForm.role),
          startDate: normalizeDateInput(createForm.startDate) ?? undefined,
          endDate: normalizeDateInput(createForm.endDate) ?? undefined,
          status: createForm.status,
          outcomes: normalizeLines(createForm.outcomesText),
          resumeSummary: normalizeOptionalText(createForm.resumeSummary),
          abilityEvidenceIds: createForm.abilityEvidenceIds,
        });

        setCreateForm(defaultFormState);
        await loadProjectsList(statusFilter, response.data.id);
        if (statusFilter === "all" || statusFilter === response.data.status) {
          setSelectedProjectId(response.data.id);
        }
        setActionState({
          type: "success",
          message:
            statusFilter !== "all" && statusFilter !== response.data.status
              ? "项目已创建，但当前筛选未显示该状态。"
              : "项目已创建，接下来可以补充证据关联和简历摘要。",
          requestId: response.requestId,
        });
      } catch (error) {
        setActionState({
          type: "error",
          message: error instanceof ApiClientError ? error.message : "创建项目失败，请稍后重试。",
          requestId: error instanceof ApiClientError ? error.requestId : undefined,
        });
      } finally {
        setIsCreating(false);
      }
    },
    [createForm, loadProjectsList, statusFilter],
  );

  const handleUpdateProject = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!selectedProjectId) {
        setActionState({
          type: "error",
          message: "请先选中一个项目再更新。",
        });
        return;
      }

      const dateRangeError = validateDateRange(editForm.startDate, editForm.endDate);
      if (dateRangeError) {
        setActionState({ type: "error", message: dateRangeError });
        return;
      }

      setIsUpdating(true);
      setActionState({ type: "idle" });

      try {
        const response = await updateProject(selectedProjectId, {
          name: editForm.name.trim() || undefined,
          description: normalizeOptionalText(editForm.description),
          role: normalizeOptionalText(editForm.role),
          startDate: normalizeDateInput(editForm.startDate) ?? undefined,
          endDate: normalizeDateInput(editForm.endDate) ?? undefined,
          status: editForm.status,
          outcomes: normalizeLines(editForm.outcomesText),
          resumeSummary: normalizeOptionalText(editForm.resumeSummary),
          abilityEvidenceIds: editForm.abilityEvidenceIds,
        });

        const nextStatus = response.data.status;
        const remainsVisible = statusFilter === "all" || statusFilter === nextStatus;

        if (remainsVisible) {
          setProjects((current) =>
            current.map((item) => (item.id === selectedProjectId ? response.data : item)),
          );
          await loadProjectDetail(selectedProjectId);
        } else {
          await loadProjectsList(statusFilter);
        }

        setActionState({
          type: "success",
          message: remainsVisible
            ? "项目已更新。能力证据详情已同步刷新。"
            : "项目已更新，但已移出当前筛选列表。",
          requestId: response.requestId,
        });
      } catch (error) {
        setActionState({
          type: "error",
          message: error instanceof ApiClientError ? error.message : "更新项目失败，请稍后重试。",
          requestId: error instanceof ApiClientError ? error.requestId : undefined,
        });
      } finally {
        setIsUpdating(false);
      }
    },
    [editForm, loadProjectDetail, loadProjectsList, selectedProjectId, statusFilter],
  );

  const handleDeleteProject = useCallback(
    async (project: Project) => {
      setDeletingProjectId(project.id);
      setActionState({ type: "idle" });

      try {
        const deletingSelected = selectedProjectIdRef.current === project.id;
        const response = await deleteProject(project.id);
        const nextPreferredId =
          deletingSelected ? null : selectedProjectIdRef.current;

        if (deletingSelected) {
          setSelectedProject(null);
          setDetailError(null);
        }

        await loadProjectsList(statusFilter, nextPreferredId);

        setActionState({
          type: "success",
          message: `已删除项目「${project.name}」。`,
          requestId: response.requestId,
        });
      } catch (error) {
        setActionState({
          type: "error",
          message: error instanceof ApiClientError ? error.message : "删除项目失败，请稍后重试。",
          requestId: error instanceof ApiClientError ? error.requestId : undefined,
        });
      } finally {
        setDeletingProjectId(null);
      }
    },
    [loadProjectsList, statusFilter],
  );

  return (
    <div className="mx-auto max-w-[1440px] space-y-8">
      <PageHeader
        eyebrow="项目经历"
        title="项目经历与能力证据工作台"
        description="这里用于整理个人项目经历、简历摘要和能力证据关联。项目可先整理为草稿，但长期归档与能力证据仍以你确认后的正式记录为准。"
        actions={
          <Button asChild variant="secondary">
            <Link href="/ability-tree">去能力树确认候选证据</Link>
          </Button>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(360px,0.94fr)_minmax(0,1.06fr)]">
        <div className="space-y-6">
          <ResumeDocumentsSection />
          <ResumeMaterialsSection />
          <ResumeGapAnalysisSection />
          <ProjectPackagingSuggestionsSection projects={projects} />

          <SectionCard
            title="新增项目经历"
            eyebrow="Create Project"
            description="手动补录项目、角色、结果和简历摘要。能力证据只支持关联已确认条目，候选证据请先去能力树确认。"
          >
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/10 px-4 py-4 text-sm leading-6 text-foreground">
                当前页面聚焦项目经历整理与能力证据关联。项目包装建议和岗位差距分析已经提供
                <span className="font-medium text-foreground"> deterministic 草稿 </span>
                ，但写入简历前仍需要你逐条确认真实性、量化口径和岗位措辞。
              </div>

              {actionState.type !== "idle" ? <FeedbackBanner state={actionState} /> : null}

              <form className="space-y-4" onSubmit={handleCreateProject}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="project-name">
                    项目名称
                  </label>
                  <input
                    id="project-name"
                    value={createForm.name}
                    onChange={(event) => handleCreateFormChange("name", event.target.value)}
                    placeholder="例如：数字原生自我工作台"
                    className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    id="project-role"
                    label="你的角色"
                    value={createForm.role}
                    onChange={(value) => handleCreateFormChange("role", value)}
                    placeholder="例如：前端负责人 / 独立开发"
                  />

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="project-status">
                      项目状态
                    </label>
                    <select
                      id="project-status"
                      value={createForm.status}
                      onChange={(event) =>
                        handleCreateFormChange("status", event.target.value as ProjectStatus)
                      }
                      className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                    >
                      {projectStatusValues.map((status) => (
                        <option key={status} value={status}>
                          {projectStatusLabelMap[status]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <DateField
                    id="project-start-date"
                    label="开始时间"
                    value={createForm.startDate}
                    onChange={(value) => handleCreateFormChange("startDate", value)}
                  />
                  <DateField
                    id="project-end-date"
                    label="结束时间"
                    value={createForm.endDate}
                    onChange={(value) => handleCreateFormChange("endDate", value)}
                  />
                </div>

                <TextAreaField
                  id="project-description"
                  label="项目说明"
                  value={createForm.description}
                  onChange={(value) => handleCreateFormChange("description", value)}
                  placeholder="记录项目背景、目标和你负责的范围。"
                  minHeightClassName="min-h-24"
                />

                <TextAreaField
                  id="project-outcomes"
                  label="结果产出"
                  value={createForm.outcomesText}
                  onChange={(value) => handleCreateFormChange("outcomesText", value)}
                  placeholder="每行一条，例如：上线 MVP&#10;完成真实 API 接入&#10;缩短整理项目素材时间"
                  minHeightClassName="min-h-24"
                />

                <TextAreaField
                  id="project-resume-summary"
                  label="简历摘要"
                  value={createForm.resumeSummary}
                  onChange={(value) => handleCreateFormChange("resumeSummary", value)}
                  placeholder="先手动写一句简历版摘要；也可以参考上方 deterministic 项目包装建议。"
                  minHeightClassName="min-h-24"
                />

                <EvidencePicker
                  title="关联能力证据"
                  description="仅展示已确认的 AbilityEvidence。候选证据不会直接归档到项目。"
                  isLoading={isEvidenceLoading}
                  error={evidenceError}
                  evidenceItems={confirmedEvidence}
                  selectedIds={createForm.abilityEvidenceIds}
                  onToggle={(abilityEvidenceId) =>
                    handleCreateFormChange(
                      "abilityEvidenceIds",
                      toggleId(createForm.abilityEvidenceIds, abilityEvidenceId),
                    )
                  }
                />

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? "创建中..." : "创建项目"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={isCreating}
                    onClick={() => setCreateForm(defaultFormState)}
                  >
                    清空表单
                  </Button>
                </div>
              </form>
            </div>
          </SectionCard>

          <SectionCard
            title="项目列表"
            eyebrow="Projects"
            description={`列表来自 GET /api/projects。当前展示前 ${listLimit} 条，可按状态筛选。`}
            actions={
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  void loadProjectsList(statusFilter);
                  void loadConfirmedEvidence();
                  if (selectedProjectIdRef.current) {
                    void loadProjectDetail(selectedProjectIdRef.current);
                  }
                }}
                disabled={isListLoading || isEvidenceLoading || isCreating || isUpdating || deletingProjectId !== null}
              >
                刷新
              </Button>
            }
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {filterOptions.map((option) => {
                  const active = statusFilter === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setStatusFilter(option)}
                      className={cn(
                        "rounded-full border px-3 py-2 text-xs font-medium transition-colors",
                        active
                          ? "border-emerald-500/30 bg-emerald-500/10 text-foreground"
                          : "border-white/10 bg-background/50 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {option === "all" ? "全部" : projectStatusLabelMap[option]}
                    </button>
                  );
                })}
              </div>

              {listError ? <ErrorState message={listError} /> : null}

              {!listError && isListLoading ? (
                <EmptyState text="正在加载项目列表..." />
              ) : null}

              {!listError && !isListLoading && projects.length === 0 ? (
                <EmptyState text="当前筛选下还没有项目经历。可以先创建一条项目，再逐步补齐结果与证据。" />
              ) : null}

              {!listError && !isListLoading && projects.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <StatCard label="当前列表" value={`${projects.length}`} helper={`共 ${total} 条`} />
                    <StatCard label="已完成" value={`${completedCount}`} helper="适合优先写成简历素材" />
                    <StatCard label="已归档" value={`${archivedCount}`} helper="便于保留历史项目脉络" />
                  </div>

                  {projects.map((project) => {
                    const isSelected = selectedProjectId === project.id;
                    const isDeleting = deletingProjectId === project.id;

                    return (
                      <article
                        key={project.id}
                        className={cn(
                          "rounded-xl border p-5 transition-colors",
                          isSelected
                            ? "border-emerald-500/25 bg-emerald-500/10"
                            : "border-white/10 bg-white/5",
                        )}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                                {project.name}
                              </h2>
                              <StatusBadge status={project.status} />
                              {project.role ? <MetaBadge text={project.role} tone="sky" /> : null}
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <InfoBlock
                                label="时间范围"
                                value={formatDateRange(project.startDate, project.endDate)}
                              />
                              <InfoBlock
                                label="结果摘要"
                                value={summarizeOutcomes(project.outcomes)}
                                multiline
                              />
                            </div>

                            {project.description?.trim() ? (
                              <InfoBlock
                                label="项目说明"
                                value={project.description.trim()}
                                multiline
                              />
                            ) : null}
                          </div>

                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={isSelected ? "secondary" : "default"}
                              onClick={() => handleSelectProject(project.id)}
                            >
                              {isSelected ? "已选中" : "查看证据"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
                              disabled={isDeleting}
                              onClick={() => void handleDeleteProject(project)}
                            >
                              {isDeleting ? "删除中..." : "删除"}
                            </Button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard
            title="项目详情与证据"
            eyebrow="Detail"
            description="点击列表中的项目后，会调用 GET /api/projects/:id 读取关联能力证据明细。"
          >
            {detailError ? <ErrorState message={detailError} /> : null}

            {!detailError && isDetailLoading ? (
              <EmptyState text="正在加载项目详情与能力证据..." />
            ) : null}

            {!detailError && !isDetailLoading && !selectedProjectSummary ? (
              <EmptyState text="请先从左侧项目列表中选择一条项目。" />
            ) : null}

            {!detailError && !isDetailLoading && selectedProjectSummary && selectedProject ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-white/10 bg-background/45 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold tracking-tight text-foreground">
                          {selectedProject.name}
                        </h2>
                        <StatusBadge status={selectedProject.status} />
                        {selectedProject.role ? (
                          <MetaBadge text={selectedProject.role} tone="sky" />
                        ) : null}
                        <MetaBadge
                          text={`${selectedEvidenceCount} 条已关联证据`}
                          tone="emerald"
                        />
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {selectedProject.description?.trim() || "当前还没有项目说明。"}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      更新于 {formatDateTime(selectedProject.updatedAt) ?? "未知时间"}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <InfoBlock
                      label="时间范围"
                      value={formatDateRange(selectedProject.startDate, selectedProject.endDate)}
                    />
                    <InfoBlock
                      label="结果产出"
                      value={selectedProject.outcomes.length > 0 ? selectedProject.outcomes.join("；") : "暂未填写"}
                      multiline
                    />
                    <InfoBlock
                      label="简历摘要"
                      value={selectedProject.resumeSummary?.trim() || "暂未填写"}
                      multiline
                    />
                    <InfoBlock
                      label="AI 包装建议"
                      value="已接入左侧项目包装建议区；生成结果是 deterministic 草稿，写入简历前仍需人工确认。"
                      multiline
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-lg border border-dashed border-primary/20 bg-primary/5 px-4 py-4 text-sm leading-6 text-muted-foreground">
                    这里展示的是已经关联到项目的能力证据明细。候选证据只有在能力树确认后，才建议回到这里正式挂载。
                  </div>

                  {selectedProject.abilityEvidenceItems.length === 0 ? (
                    <EmptyState text="当前项目还没有关联任何已确认能力证据。" />
                  ) : (
                    <div className="space-y-3">
                      {selectedProject.abilityEvidenceItems.map((item) => (
                        <article
                          key={item.id}
                          className="rounded-lg border border-white/10 bg-white/5 p-4"
                        >
                          <div className="flex flex-wrap gap-2">
                            <MetaBadge text={`节点 ${item.abilityNodeId.slice(0, 8)}`} />
                            <MetaBadge text={item.status === "confirmed" ? "已确认" : item.status} tone="emerald" />
                            <MetaBadge text={impactLabelMap[item.impact]} tone="purple" />
                          </div>
                          <p className="mt-3 text-sm leading-7 text-foreground">{item.content}</p>
                          <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                            <span>难度 {item.difficultyScore}</span>
                            <span>独立性 {item.independenceScore}</span>
                            <span>影响力 {item.impactScore}</span>
                            <span>反馈 {item.feedbackScore}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            title="最小更新"
            eyebrow="Update Project"
            description="支持更新项目状态、简历摘要、能力证据关联，以及必要的项目基础字段。"
          >
            {!selectedProjectSummary ? (
              <EmptyState text="先选中项目后，才能更新状态、摘要和证据关联。" />
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-dashed border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-muted-foreground">
                  当前更新接口更适合补充和覆盖字段，暂不支持把已有文本或日期显式清空为 null。
                </div>

                <form className="space-y-4" onSubmit={handleUpdateProject}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      id="edit-project-name"
                      label="项目名称"
                      value={editForm.name}
                      onChange={(value) => handleEditFormChange("name", value)}
                      placeholder="项目名称"
                    />
                    <TextField
                      id="edit-project-role"
                      label="你的角色"
                      value={editForm.role}
                      onChange={(value) => handleEditFormChange("role", value)}
                      placeholder="你的角色"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="edit-project-status">
                        项目状态
                      </label>
                      <select
                        id="edit-project-status"
                        value={editForm.status}
                        onChange={(event) =>
                          handleEditFormChange("status", event.target.value as ProjectStatus)
                        }
                        className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                      >
                        {projectStatusValues.map((status) => (
                          <option key={status} value={status}>
                            {projectStatusLabelMap[status]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <DateField
                      id="edit-project-start-date"
                      label="开始时间"
                      value={editForm.startDate}
                      onChange={(value) => handleEditFormChange("startDate", value)}
                    />
                    <DateField
                      id="edit-project-end-date"
                      label="结束时间"
                      value={editForm.endDate}
                      onChange={(value) => handleEditFormChange("endDate", value)}
                    />
                  </div>

                  <TextAreaField
                    id="edit-project-description"
                    label="项目说明"
                    value={editForm.description}
                    onChange={(value) => handleEditFormChange("description", value)}
                    placeholder="项目背景与职责范围"
                    minHeightClassName="min-h-24"
                  />

                  <TextAreaField
                    id="edit-project-outcomes"
                    label="结果产出"
                    value={editForm.outcomesText}
                    onChange={(value) => handleEditFormChange("outcomesText", value)}
                    placeholder="每行一条结果"
                    minHeightClassName="min-h-24"
                  />

                  <TextAreaField
                    id="edit-project-summary"
                    label="简历摘要"
                    value={editForm.resumeSummary}
                    onChange={(value) => handleEditFormChange("resumeSummary", value)}
                    placeholder="手动维护项目简历摘要"
                    minHeightClassName="min-h-24"
                  />

                  <EvidencePicker
                    title="关联能力证据"
                    description="更新项目时会整体覆盖关联证据列表。"
                    isLoading={isEvidenceLoading}
                    error={evidenceError}
                    evidenceItems={confirmedEvidence}
                    selectedIds={editForm.abilityEvidenceIds}
                    onToggle={(abilityEvidenceId) =>
                      handleEditFormChange(
                        "abilityEvidenceIds",
                        toggleId(editForm.abilityEvidenceIds, abilityEvidenceId),
                      )
                    }
                  />

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={isUpdating}>
                      {isUpdating ? "保存中..." : "保存更新"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={isUpdating || !selectedProject}
                      onClick={() => {
                        if (!selectedProject) {
                          return;
                        }

                        setEditForm({
                          name: selectedProject.name,
                          description: selectedProject.description ?? "",
                          role: selectedProject.role ?? "",
                          startDate: toDateInputValue(selectedProject.startDate),
                          endDate: toDateInputValue(selectedProject.endDate),
                          status: selectedProject.status,
                          outcomesText: selectedProject.outcomes.join("\n"),
                          resumeSummary: selectedProject.resumeSummary ?? "",
                          abilityEvidenceIds: selectedProject.abilityEvidenceItems.map((item) => item.id),
                        });
                      }}
                    >
                      重置为详情值
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </SectionCard>
        </div>
      </section>
    </div>
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

function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
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

function EvidencePicker({
  title,
  description,
  isLoading,
  error,
  evidenceItems,
  selectedIds,
  onToggle,
}: {
  title: string;
  description: string;
  isLoading: boolean;
  error: string | null;
  evidenceItems: AbilityEvidence[];
  selectedIds: string[];
  onToggle: (abilityEvidenceId: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-background/40 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      {error ? <ErrorState message={error} /> : null}

      {!error && isLoading ? (
        <EmptyState text="正在读取已确认能力证据..." />
      ) : null}

      {!error && !isLoading && evidenceItems.length === 0 ? (
        <EmptyState text="当前没有已确认能力证据。请先去能力树确认候选证据，再回到这里关联。" />
      ) : null}

      {!error && !isLoading && evidenceItems.length > 0 ? (
        <div className="space-y-3">
          {evidenceItems.map((item) => {
            const checked = selectedIds.includes(item.id);

            return (
              <label
                key={item.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm transition-colors",
                  checked
                    ? "border-emerald-500/20 bg-emerald-500/10"
                    : "border-white/10 bg-white/5",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(item.id)}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-background/50"
                />
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <MetaBadge text={impactLabelMap[item.impact]} tone="purple" />
                    <MetaBadge text={`节点 ${item.abilityNodeId.slice(0, 8)}`} />
                  </div>
                  <p className="leading-6 text-foreground">{item.content}</p>
                </div>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const classNameMap: Record<ProjectStatus, string> = {
    planned: "border-amber-500/20 bg-amber-500/10 text-foreground",
    active: "border-emerald-500/20 bg-emerald-500/10 text-foreground",
    completed: "border-sky-500/20 bg-sky-500/10 text-foreground",
    archived: "border-violet-500/20 bg-violet-500/10 text-foreground",
  };

  return (
    <span className={cn("rounded-full border px-3 py-1 text-xs font-medium", classNameMap[status])}>
      {projectStatusLabelMap[status]}
    </span>
  );
}

function MetaBadge({
  text,
  tone = "default",
}: {
  text: string;
  tone?: "default" | "emerald" | "sky" | "purple";
}) {
  const classNameMap = {
    default: "border-white/10 bg-background/50 text-muted-foreground",
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-foreground",
    sky: "border-sky-500/20 bg-sky-500/10 text-foreground",
    purple: "border-violet-500/20 bg-violet-500/10 text-foreground",
  } as const;

  return (
    <span className={cn("rounded-full border px-3 py-1 text-xs", classNameMap[tone])}>{text}</span>
  );
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-background/45 px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{helper}</p>
    </div>
  );
}

function InfoBlock({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-background/45 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-sm text-foreground",
          multiline ? "leading-7 text-muted-foreground" : "leading-6",
        )}
      >
        {value}
      </p>
    </div>
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

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-4 text-sm leading-6 text-foreground">
      {message}
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

const impactLabelMap = {
  positive: "正向影响",
  neutral: "中性影响",
  negative: "负向影响",
} as const;

function toggleId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

function normalizeLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeDateInput(value: string) {
  const trimmed = value.trim();
  return trimmed ? `${trimmed}T00:00:00.000Z` : null;
}

function toDateInputValue(value?: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function validateDateRange(startDate: string, endDate: string) {
  if (!startDate || !endDate) {
    return null;
  }

  return startDate <= endDate ? null : "开始时间不能晚于结束时间。";
}

function summarizeOutcomes(outcomes: string[]) {
  if (outcomes.length === 0) {
    return "暂未填写";
  }

  if (outcomes.length <= 2) {
    return outcomes.join("；");
  }

  return `${outcomes.slice(0, 2).join("；")}；另有 ${outcomes.length - 2} 条结果`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateRange(startDate?: string | null, endDate?: string | null) {
  const startLabel = formatDate(startDate);
  const endLabel = formatDate(endDate);

  if (startLabel && endLabel) {
    return `${startLabel} - ${endLabel}`;
  }

  if (startLabel) {
    return `${startLabel} - 至今`;
  }

  if (endLabel) {
    return `结束于 ${endLabel}`;
  }

  return "时间未填写";
}
