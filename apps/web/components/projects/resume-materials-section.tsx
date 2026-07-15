"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { SectionCard } from "@/components/shell/section-card";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api-client";
import {
  deleteResumeMaterial,
  extractResumeMaterialCandidates,
  listResumeMaterials,
  resumeMaterialSourceTypeValues,
  resumeMaterialStatusValues,
  resumeMaterialTypeValues,
  reviewResumeMaterial,
  type ExtractResumeMaterialCandidatesResponse,
  type ResumeMaterial,
  type ResumeMaterialSourceType,
  type ResumeMaterialStatus,
  type ResumeMaterialType,
} from "@/lib/resume-materials";
import { cn } from "@/lib/utils";

const listLimit = 24;
const extractLimitOptions = [1, 2, 3, 5] as const;
const filterStatusOptions = ["all", ...resumeMaterialStatusValues] as const;
type ResumeMaterialFilterStatus = (typeof filterStatusOptions)[number];
type ResumeMaterialSourceFilter = ResumeMaterialSourceType | "all";

const sourceLabelMap: Record<ResumeMaterialSourceType, string> = {
  ability_evidence: "能力证据",
  project: "项目经历",
  resume_document: "简历原文",
  daily_entry: "日记 / 日报",
  manual: "手动补充",
};

const materialTypeLabelMap: Record<ResumeMaterialType, string> = {
  achievement: "成果",
  responsibility: "职责",
  skill: "技能",
  project_summary: "项目摘要",
  reflection: "复盘",
  other: "其他",
};

const statusLabelMap: Record<ResumeMaterialStatus, string> = {
  candidate: "候选",
  confirmed: "已确认",
  rejected: "已拒绝",
};

type ActionState =
  | { type: "idle" }
  | { type: "success"; message: string; requestId?: string }
  | { type: "error"; message: string; requestId?: string };

type ConfirmFormState = {
  content: string;
  suggestedBullet: string;
  materialType: ResumeMaterialType;
};

const defaultConfirmFormState: ConfirmFormState = {
  content: "",
  suggestedBullet: "",
  materialType: "achievement",
};

export function ResumeMaterialsSection() {
  const [materials, setMaterials] = useState<ResumeMaterial[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<ResumeMaterialFilterStatus>("candidate");
  const [sourceFilter, setSourceFilter] = useState<ResumeMaterialSourceFilter>("all");
  const [extractLimit, setExtractLimit] = useState<string>("2");
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [confirmForm, setConfirmForm] = useState<ConfirmFormState>(defaultConfirmFormState);
  const [lastExtraction, setLastExtraction] =
    useState<ExtractResumeMaterialCandidatesResponse | null>(null);
  const [isListLoading, setIsListLoading] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [reviewingMaterialId, setReviewingMaterialId] = useState<string | null>(null);
  const [deletingMaterialId, setDeletingMaterialId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>({ type: "idle" });

  const loadMaterials = useCallback(
    async (
      nextStatusFilter: ResumeMaterialFilterStatus = statusFilter,
      nextSourceFilter: ResumeMaterialSourceFilter = sourceFilter,
    ) => {
      setIsListLoading(true);
      setListError(null);

      try {
        const response = await listResumeMaterials({
          status: nextStatusFilter === "all" ? undefined : nextStatusFilter,
          sourceType: nextSourceFilter === "all" ? undefined : nextSourceFilter,
          limit: listLimit,
          offset: 0,
        });

        setMaterials(response.data.items);
        setTotal(response.data.pagination.total);
      } catch (error) {
        const message =
          error instanceof ApiClientError
            ? `${error.message}${error.requestId ? `（requestId: ${error.requestId}）` : ""}`
            : "当前无法读取候选简历素材，请确认后端服务已启动。";

        setMaterials([]);
        setTotal(0);
        setListError(message);
      } finally {
        setIsListLoading(false);
      }
    },
    [sourceFilter, statusFilter],
  );

  useEffect(() => {
    void loadMaterials(statusFilter, sourceFilter);
  }, [loadMaterials, sourceFilter, statusFilter]);

  const candidateCount = useMemo(
    () => materials.filter((item) => item.status === "candidate").length,
    [materials],
  );
  const confirmedCount = useMemo(
    () => materials.filter((item) => item.status === "confirmed").length,
    [materials],
  );
  const visibleSourceCount = useMemo(
    () => new Set(materials.map((item) => item.sourceType)).size,
    [materials],
  );

  const handleStartConfirm = useCallback((material: ResumeMaterial) => {
    setEditingMaterialId(material.id);
    setConfirmForm({
      content: material.content,
      suggestedBullet: material.suggestedBullet ?? "",
      materialType: material.materialType,
    });
    setActionState({ type: "idle" });
  }, []);

  const handleCancelConfirm = useCallback(() => {
    setEditingMaterialId(null);
    setConfirmForm(defaultConfirmFormState);
  }, []);

  const handleExtractCandidates = useCallback(async () => {
    const parsedLimit = Number(extractLimit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 10) {
      setActionState({
        type: "error",
        message: "每类来源提取上限需要是 1 到 10 之间的整数。",
      });
      return;
    }

    setIsExtracting(true);
    setActionState({ type: "idle" });

    try {
      const response = await extractResumeMaterialCandidates({
        limitPerSource: parsedLimit,
      });

      setLastExtraction(response.data);
      setEditingMaterialId(null);
      setConfirmForm(defaultConfirmFormState);
      await loadMaterials(statusFilter, sourceFilter);
      setActionState({
        type: "success",
        message:
          response.data.created.length > 0
            ? `已提取 ${response.data.created.length} 条候选素材。它们仍停留在候选层，只有你确认后才会进入正式素材档案。`
            : `本次没有新增候选素材，已跳过 ${response.data.skippedCount} 条重复候选。`,
        requestId: response.requestId,
      });
    } catch (error) {
      setActionState(toActionError(error, "extract"));
    } finally {
      setIsExtracting(false);
    }
  }, [extractLimit, loadMaterials, sourceFilter, statusFilter]);

  const handleConfirm = useCallback(
    async (event: FormEvent<HTMLFormElement>, material: ResumeMaterial) => {
      event.preventDefault();

      if (!confirmForm.content.trim()) {
        setActionState({
          type: "error",
          message: "确认前请至少保留一段可用素材内容。",
        });
        return;
      }

      setReviewingMaterialId(material.id);
      setActionState({ type: "idle" });

      try {
        const response = await reviewResumeMaterial(material.id, {
          status: "confirmed",
          content: confirmForm.content.trim(),
          suggestedBullet: normalizeNullableText(confirmForm.suggestedBullet),
          materialType: confirmForm.materialType,
        });

        setEditingMaterialId(null);
        setConfirmForm(defaultConfirmFormState);
        await loadMaterials(statusFilter, sourceFilter);
        setActionState({
          type: "success",
          message: `已确认候选素材「${getMaterialHeading(material)}」。这一步只是在素材层确认，不会自动替你生成最终简历表述。`,
          requestId: response.requestId,
        });
      } catch (error) {
        setActionState(toActionError(error, "confirm"));
      } finally {
        setReviewingMaterialId(null);
      }
    },
    [confirmForm, loadMaterials, sourceFilter, statusFilter],
  );

  const handleReject = useCallback(
    async (material: ResumeMaterial) => {
      setReviewingMaterialId(material.id);
      setActionState({ type: "idle" });

      try {
        const response = await reviewResumeMaterial(material.id, {
          status: "rejected",
        });

        if (editingMaterialId === material.id) {
          setEditingMaterialId(null);
          setConfirmForm(defaultConfirmFormState);
        }

        await loadMaterials(statusFilter, sourceFilter);
        setActionState({
          type: "success",
          message: `已拒绝候选素材「${getMaterialHeading(material)}」。它不会进入正式素材档案。`,
          requestId: response.requestId,
        });
      } catch (error) {
        setActionState(toActionError(error, "reject"));
      } finally {
        setReviewingMaterialId(null);
      }
    },
    [editingMaterialId, loadMaterials, sourceFilter, statusFilter],
  );

  const handleDelete = useCallback(
    async (material: ResumeMaterial) => {
      setDeletingMaterialId(material.id);
      setActionState({ type: "idle" });

      try {
        const response = await deleteResumeMaterial(material.id);

        if (editingMaterialId === material.id) {
          setEditingMaterialId(null);
          setConfirmForm(defaultConfirmFormState);
        }

        await loadMaterials(statusFilter, sourceFilter);
        setActionState({
          type: "success",
          message: `已删除素材「${getMaterialHeading(material)}」。`,
          requestId: response.requestId,
        });
      } catch (error) {
        setActionState(toActionError(error, "delete"));
      } finally {
        setDeletingMaterialId(null);
      }
    },
    [editingMaterialId, loadMaterials, sourceFilter, statusFilter],
  );

  const isBusy =
    isListLoading || isExtracting || reviewingMaterialId !== null || deletingMaterialId !== null;

  return (
    <SectionCard
      title="候选简历素材"
      eyebrow="Resume Materials"
      description="这里展示的是从项目、能力证据、简历原文和日记中提取出来的候选素材。只有你确认后，它才会成为正式素材；这里不会自动包装成最终简历。"
      actions={
        <Button type="button" variant="ghost" disabled={isBusy} onClick={() => void loadMaterials()}>
          刷新
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-dashed border-white/10 bg-white/5 px-4 py-4 text-sm leading-6 text-muted-foreground">
          这是一层
          <span className="font-medium text-foreground"> 候选素材缓冲区 </span>
          ：系统只帮你把可能有用的片段找出来，不会自动把它写进正式简历，也不会假装已经完成 AI 包装。请在确认前自己筛选、修改和取舍。
        </div>

        {actionState.type !== "idle" ? <FeedbackBanner state={actionState} /> : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.74fr)_minmax(320px,0.26fr)]">
          <div className="space-y-4 rounded-lg border border-white/10 bg-background/40 p-4">
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-foreground">提取候选素材</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                调用 <code>POST /api/resume-materials/extract-candidates</code>，按来源扫出新的候选项。提取结果仍然停留在候选层。
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="w-full space-y-2 sm:max-w-[220px]">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="resume-material-extract-limit"
                >
                  每类来源提取上限
                </label>
                <select
                  id="resume-material-extract-limit"
                  value={extractLimit}
                  onChange={(event) => setExtractLimit(event.target.value)}
                  className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                >
                  {extractLimitOptions.map((option) => (
                    <option key={option} value={option}>
                      {option} 条
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" disabled={isExtracting} onClick={() => void handleExtractCandidates()}>
                  {isExtracting ? "提取中..." : "提取候选素材"}
                </Button>
                <p className="text-xs leading-5 text-muted-foreground">
                  默认优先拉取少量候选，减少一次性堆满列表。
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <StatCard label="当前展示" value={`${materials.length}`} helper={`筛选后共 ${total} 条`} />
            <StatCard label="候选中" value={`${candidateCount}`} helper="默认优先处理 candidate" />
            <StatCard label="来源数" value={`${visibleSourceCount}`} helper={`已确认 ${confirmedCount} 条`} />
          </div>
        </div>

        {lastExtraction ? (
          <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/10 px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <MetaBadge text={`新增 ${lastExtraction.created.length}`} tone="emerald" />
              <MetaBadge text={`跳过 ${lastExtraction.skippedCount}`} tone="default" />
              <MetaBadge text={`证据 ${lastExtraction.scanned.abilityEvidence}`} tone="sky" />
              <MetaBadge text={`项目 ${lastExtraction.scanned.projects}`} tone="sky" />
              <MetaBadge text={`简历 ${lastExtraction.scanned.resumeDocuments}`} tone="sky" />
              <MetaBadge text={`日记 ${lastExtraction.scanned.dailyEntries}`} tone="sky" />
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              这只是最近一次提取概览。即使提取成功，新的条目也仍然是候选素材，需要你逐条确认或拒绝。
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-4 rounded-lg border border-white/10 bg-background/40 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-foreground">候选列表</h3>
                <p className="text-sm leading-6 text-muted-foreground">
                  第一版默认聚焦 candidate。你可以切换状态或来源查看已确认、已拒绝的素材。
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {filterStatusOptions.map((option) => {
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
                      {option === "all" ? "全部状态" : statusLabelMap[option]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="w-full max-w-[220px] space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="resume-material-source-filter">
                来源筛选
              </label>
              <select
                id="resume-material-source-filter"
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value as ResumeMaterialSourceFilter)}
                className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              >
                <option value="all">全部来源</option>
                {resumeMaterialSourceTypeValues.map((sourceType) => (
                  <option key={sourceType} value={sourceType}>
                    {sourceLabelMap[sourceType]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {listError ? <ErrorState message={listError} /> : null}

          {!listError && isListLoading ? <EmptyState text="正在读取候选简历素材..." /> : null}

          {!listError && !isListLoading && materials.length === 0 ? (
            <EmptyState
              text={
                statusFilter === "candidate"
                  ? "当前没有候选素材。可以先触发一次提取，或切换到其他状态查看历史确认结果。"
                  : "当前筛选下没有素材。可以切换状态或来源继续查看。"
              }
            />
          ) : null}

          {!listError && !isListLoading && materials.length > 0 ? (
            <div className="space-y-3">
              {materials.map((material) => {
                const isCandidate = material.status === "candidate";
                const isEditing = editingMaterialId === material.id;
                const isReviewing = reviewingMaterialId === material.id;
                const isDeleting = deletingMaterialId === material.id;

                return (
                  <article
                    key={material.id}
                    className={cn(
                      "rounded-xl border p-4 transition-colors",
                      isEditing
                        ? "border-emerald-500/25 bg-emerald-500/10"
                        : "border-white/10 bg-white/5",
                    )}
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold tracking-tight text-foreground">
                            {getMaterialHeading(material)}
                          </h3>
                          <StatusBadge status={material.status} />
                          <MetaBadge text={sourceLabelMap[material.sourceType]} tone="sky" />
                          <MetaBadge text={materialTypeLabelMap[material.materialType]} tone="purple" />
                        </div>

                        <div className="grid gap-3 lg:grid-cols-2">
                          <InfoBlock
                            label="素材内容"
                            value={material.content}
                            multiline
                            preserveWhitespace
                          />
                          <InfoBlock
                            label="建议 bullet"
                            value={material.suggestedBullet?.trim() || "暂未生成建议 bullet"}
                            multiline
                            preserveWhitespace
                          />
                          <InfoBlock
                            label="更新时间"
                            value={formatDateTime(material.updatedAt) ?? "未知时间"}
                          />
                          <InfoBlock
                            label="来源 ID"
                            value={material.sourceId?.slice(0, 12) || "manual / 无外部来源"}
                          />
                        </div>

                        {isEditing ? (
                          <form
                            className="space-y-4 rounded-lg border border-white/10 bg-background/45 p-4"
                            onSubmit={(event) => void handleConfirm(event, material)}
                          >
                            <div className="space-y-1">
                              <h4 className="text-sm font-medium text-foreground">确认前最小编辑</h4>
                              <p className="text-sm leading-6 text-muted-foreground">
                                这里只允许你修正素材内容、建议 bullet 和素材类型。确认后它只会变成正式素材，不会自动写回项目或生成最终简历。
                              </p>
                            </div>

                            <TextAreaField
                              id={`resume-material-content-${material.id}`}
                              label="素材内容"
                              value={confirmForm.content}
                              onChange={(value) =>
                                setConfirmForm((current) => ({ ...current, content: value }))
                              }
                              placeholder="保留最能证明经历的原始表述。"
                              minHeightClassName="min-h-28"
                            />

                            <TextAreaField
                              id={`resume-material-bullet-${material.id}`}
                              label="建议 bullet（可选）"
                              value={confirmForm.suggestedBullet}
                              onChange={(value) =>
                                setConfirmForm((current) => ({
                                  ...current,
                                  suggestedBullet: value,
                                }))
                              }
                              placeholder="手动整理成一句更接近简历语气的候选表达。"
                              minHeightClassName="min-h-24"
                            />

                            <div className="space-y-2">
                              <label
                                className="text-sm font-medium text-foreground"
                                htmlFor={`resume-material-type-${material.id}`}
                              >
                                素材类型
                              </label>
                              <select
                                id={`resume-material-type-${material.id}`}
                                value={confirmForm.materialType}
                                onChange={(event) =>
                                  setConfirmForm((current) => ({
                                    ...current,
                                    materialType: event.target.value as ResumeMaterialType,
                                  }))
                                }
                                className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                              >
                                {resumeMaterialTypeValues.map((materialType) => (
                                  <option key={materialType} value={materialType}>
                                    {materialTypeLabelMap[materialType]}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              <Button type="submit" disabled={isReviewing}>
                                {isReviewing ? "确认中..." : "确认为正式素材"}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                disabled={isReviewing}
                                onClick={handleCancelConfirm}
                              >
                                取消
                              </Button>
                            </div>
                          </form>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {isCandidate ? (
                          <Button
                            type="button"
                            size="sm"
                            variant={isEditing ? "secondary" : "default"}
                            disabled={isReviewing}
                            onClick={() => handleStartConfirm(material)}
                          >
                            {isEditing ? "正在编辑" : "确认并编辑"}
                          </Button>
                        ) : null}
                        {isCandidate ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={isReviewing}
                            onClick={() => void handleReject(material)}
                          >
                            {isReviewing ? "处理中..." : "拒绝"}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
                          disabled={isDeleting}
                          onClick={() => void handleDelete(material)}
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
      </div>
    </SectionCard>
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
  preserveWhitespace = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  preserveWhitespace?: boolean;
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
          preserveWhitespace ? "max-h-40 overflow-auto whitespace-pre-wrap pr-1" : "",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: ResumeMaterialStatus }) {
  const classNameMap: Record<ResumeMaterialStatus, string> = {
    candidate: "border-amber-500/20 bg-amber-500/10 text-foreground",
    confirmed: "border-emerald-500/20 bg-emerald-500/10 text-foreground",
    rejected: "border-rose-500/20 bg-rose-500/10 text-foreground",
  };

  return (
    <span className={cn("rounded-full border px-3 py-1 text-xs font-medium", classNameMap[status])}>
      {statusLabelMap[status]}
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

function toActionError(error: unknown, action: "extract" | "confirm" | "reject" | "delete"): ActionState {
  const fallbackMessageMap = {
    extract: "提取候选素材失败，请稍后重试。",
    confirm: "确认候选素材失败，请稍后重试。",
    reject: "拒绝候选素材失败，请稍后重试。",
    delete: "删除素材失败，请稍后重试。",
  } as const;

  if (error instanceof ApiClientError) {
    return {
      type: "error",
      message: error.message,
      requestId: error.requestId,
    };
  }

  return {
    type: "error",
    message: fallbackMessageMap[action],
  };
}

function normalizeNullableText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getMaterialHeading(material: ResumeMaterial) {
  return `${materialTypeLabelMap[material.materialType]} · ${sourceLabelMap[material.sourceType]}`;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
