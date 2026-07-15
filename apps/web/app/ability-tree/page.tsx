"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { PageHeader } from "@/components/shell/page-header";
import { SectionCard } from "@/components/shell/section-card";
import { Button } from "@/components/ui/button";
import {
  abilityEvidenceImpactValues,
  abilityEvidenceScoreRange,
  abilityFeedbackScoreRange,
  createAbilityEvidence,
  deleteAbilityEvidence,
  reviewAbilityEvidence,
  type AbilityEvidence,
  type AbilityEvidenceImpact,
} from "@/lib/ability-evidence";
import { ApiClientError } from "@/lib/api-client";
import {
  createAbilityNode,
  deleteAbilityNode,
  getAbilityNode,
  listAbilityNodes,
  updateAbilityNode,
  type AbilityNodeDetail,
} from "@/lib/ability-nodes";

type ActionState =
  | { type: "idle" }
  | { type: "success"; message: string; requestId?: string }
  | { type: "error"; message: string; requestId?: string };

type MoveOption = {
  id: string | null;
  label: string;
  disabled: boolean;
};

type EvidenceFormState = {
  content: string;
  impact: AbilityEvidenceImpact;
  difficultyScore: number;
  independenceScore: number;
  impactScore: number;
  feedbackScore: number;
  recurrenceCount: number;
};

const originLabelMap = {
  system: "系统节点",
  custom: "自定义节点",
} as const;

const abilityEvidenceStatusLabelMap = {
  candidate: "待确认",
  confirmed: "已确认",
  rejected: "已拒绝",
} as const;

const abilityEvidenceImpactLabelMap = {
  positive: "正向",
  neutral: "中性",
  negative: "负向",
} as const;

const evidenceScoreOptions = buildNumberRange(
  abilityEvidenceScoreRange.min,
  abilityEvidenceScoreRange.max,
);
const feedbackScoreOptions = buildNumberRange(
  abilityFeedbackScoreRange.min,
  abilityFeedbackScoreRange.max,
);
const defaultEvidenceFormState: EvidenceFormState = {
  content: "",
  impact: "neutral",
  difficultyScore: 3,
  independenceScore: 3,
  impactScore: 3,
  feedbackScore: 0,
  recurrenceCount: 1,
};

export default function AbilityTreePage() {
  const [treeNodes, setTreeNodes] = useState<AbilityNodeDetail[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<AbilityNodeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createAsChild, setCreateAsChild] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createState, setCreateState] = useState<ActionState>({ type: "idle" });

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [moveParentId, setMoveParentId] = useState<string>("root");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateState, setUpdateState] = useState<ActionState>({ type: "idle" });

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteState, setDeleteState] = useState<ActionState>({ type: "idle" });

  const [evidenceForm, setEvidenceForm] = useState<EvidenceFormState>(defaultEvidenceFormState);
  const [isCreatingEvidence, setIsCreatingEvidence] = useState(false);
  const [evidenceCreateState, setEvidenceCreateState] = useState<ActionState>({ type: "idle" });
  const [evidenceActionState, setEvidenceActionState] = useState<ActionState>({ type: "idle" });
  const [activeEvidenceActionId, setActiveEvidenceActionId] = useState<string | null>(null);
  const [activeEvidenceActionType, setActiveEvidenceActionType] = useState<
    "confirm" | "reject" | "delete" | null
  >(null);

  const selectedNodeIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  useEffect(() => {
    setEditName(selectedNode?.name ?? "");
    setEditDescription(selectedNode?.description ?? "");
    setMoveParentId(selectedNode?.parentId ?? "root");
  }, [selectedNode]);

  const loadNodeDetail = useCallback(
    async (nodeId: string, fallbackNode?: AbilityNodeDetail | null) => {
      setIsDetailLoading(true);
      setDetailError(null);

      try {
        const response = await getAbilityNode(nodeId);
        setSelectedNode(response.data);
        return response.data;
      } catch (error) {
        const message =
          error instanceof ApiClientError
            ? `${error.message}${error.requestId ? `（requestId: ${error.requestId}）` : ""}`
            : "当前无法读取节点详情，请稍后重试。";

        if (fallbackNode) {
          setSelectedNode(fallbackNode);
        }

        setDetailError(message);
        return fallbackNode ?? null;
      } finally {
        setIsDetailLoading(false);
      }
    },
    [],
  );

  const loadTree = useCallback(
    async (preferredId?: string) => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await listAbilityNodes();
        const items = response.data.items;
        setTreeNodes(items);

        if (items.length === 0) {
          setSelectedNodeId(null);
          setSelectedNode(null);
          setDetailError(null);
          return;
        }

        const nextSelectedId = resolveSelectedNodeId(
          items,
          preferredId ?? selectedNodeIdRef.current,
        );

        if (!nextSelectedId) {
          setSelectedNodeId(null);
          setSelectedNode(null);
          setDetailError(null);
          return;
        }

        const fallbackNode = findAbilityNodeById(items, nextSelectedId);
        setSelectedNodeId(nextSelectedId);
        await loadNodeDetail(nextSelectedId, fallbackNode);
      } catch (error) {
        const message =
          error instanceof ApiClientError
            ? `${error.message}${error.requestId ? `（requestId: ${error.requestId}）` : ""}`
            : "当前无法连接 AbilityNode API，请确认后端服务已启动。";

        setLoadError(message);
        setTreeNodes([]);
        setSelectedNodeId(null);
        setSelectedNode(null);
        setDetailError(null);
      } finally {
        setIsLoading(false);
      }
    },
    [loadNodeDetail],
  );

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  const moveOptions = useMemo(
    () => buildMoveOptions(treeNodes, selectedNode?.id ?? null),
    [selectedNode?.id, treeNodes],
  );

  const handleSelectNode = useCallback(
    async (node: AbilityNodeDetail) => {
      setSelectedNodeId(node.id);
      setSelectedNode(node);
      setCreateState({ type: "idle" });
      setUpdateState({ type: "idle" });
      setDeleteState({ type: "idle" });
      setEvidenceCreateState({ type: "idle" });
      setEvidenceActionState({ type: "idle" });
      await loadNodeDetail(node.id, node);
    },
    [loadNodeDetail],
  );

  const handleCreateNode = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const name = createName.trim();
      const description = createDescription.trim();

      if (!name) {
        setCreateState({ type: "error", message: "请先填写能力节点名称。" });
        return;
      }

      setIsCreating(true);
      setCreateState({ type: "idle" });

      try {
        const response = await createAbilityNode({
          name,
          description: description || undefined,
          parentId: createAsChild && selectedNodeId ? selectedNodeId : undefined,
        });

        setCreateName("");
        setCreateDescription("");
        setCreateState({
          type: "success",
          message:
            createAsChild && selectedNode
              ? `已在「${selectedNode.name}」下创建子节点。`
              : "已创建根节点。",
          requestId: response.requestId,
        });
        await loadTree(response.data.id);
      } catch (error) {
        if (error instanceof ApiClientError) {
          setCreateState({
            type: "error",
            message: error.message,
            requestId: error.requestId,
          });
        } else {
          setCreateState({
            type: "error",
            message: "创建失败，请稍后重试。",
          });
        }
      } finally {
        setIsCreating(false);
      }
    },
    [createAsChild, createDescription, createName, loadTree, selectedNode, selectedNodeId],
  );

  const handleUpdateNode = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!selectedNode) {
        setUpdateState({ type: "error", message: "请先选择一个要编辑或移动的节点。" });
        return;
      }

      const name = editName.trim();
      const description = editDescription.trim();
      const nextParentId = moveParentId === "root" ? null : moveParentId;

      if (!name) {
        setUpdateState({ type: "error", message: "节点名称不能为空。" });
        return;
      }

      setIsUpdating(true);
      setUpdateState({ type: "idle" });

      try {
        const response = await updateAbilityNode(selectedNode.id, {
          name,
          description: description || null,
          parentId: nextParentId,
        });

        setUpdateState({
          type: "success",
          message: "已更新节点信息。",
          requestId: response.requestId,
        });
        await loadTree(response.data.id);
      } catch (error) {
        if (error instanceof ApiClientError) {
          setUpdateState({
            type: "error",
            message: error.message,
            requestId: error.requestId,
          });
        } else {
          setUpdateState({
            type: "error",
            message: "更新失败，请稍后重试。",
          });
        }
      } finally {
        setIsUpdating(false);
      }
    },
    [editDescription, editName, loadTree, moveParentId, selectedNode],
  );

  const handleDeleteNode = useCallback(async () => {
    if (!selectedNode) {
      setDeleteState({ type: "error", message: "请先选择一个要删除的节点。" });
      return;
    }

    const confirmed = window.confirm(
      `确认删除「${selectedNode.name}」吗？\n\n当前后端删除遵循现有 schema 行为，后代节点可能会被重新挂到上层或根级，后续再补更细规则。`,
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setDeleteState({ type: "idle" });

    try {
      const response = await deleteAbilityNode(selectedNode.id);
      setDeleteState({
        type: "success",
        message: "节点已删除，能力树已刷新。",
        requestId: response.requestId,
      });
      await loadTree();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setDeleteState({
          type: "error",
          message: error.message,
          requestId: error.requestId,
        });
      } else {
        setDeleteState({
          type: "error",
          message: "删除失败，请稍后重试。",
        });
      }
    } finally {
      setIsDeleting(false);
    }
  }, [loadTree, selectedNode]);

  const handleCreateEvidence = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!selectedNode) {
        setEvidenceCreateState({ type: "error", message: "请先选择一个能力节点，再新增候选证据。" });
        return;
      }

      const content = evidenceForm.content.trim();

      if (!content) {
        setEvidenceCreateState({ type: "error", message: "请先填写证据内容。" });
        return;
      }

      if (evidenceForm.recurrenceCount < 1) {
        setEvidenceCreateState({ type: "error", message: "重复出现次数至少为 1。" });
        return;
      }

      setIsCreatingEvidence(true);
      setEvidenceCreateState({ type: "idle" });
      setEvidenceActionState({ type: "idle" });

      try {
        const response = await createAbilityEvidence({
          abilityNodeId: selectedNode.id,
          content,
          impact: evidenceForm.impact,
          difficultyScore: evidenceForm.difficultyScore,
          independenceScore: evidenceForm.independenceScore,
          impactScore: evidenceForm.impactScore,
          feedbackScore: evidenceForm.feedbackScore,
          recurrenceCount: evidenceForm.recurrenceCount,
          status: "candidate",
        });

        setEvidenceForm(defaultEvidenceFormState);
        setEvidenceCreateState({
          type: "success",
          message: "已新增候选能力证据，确认后才会正式挂载归档。",
          requestId: response.requestId,
        });
        await loadTree(selectedNode.id);
      } catch (error) {
        if (error instanceof ApiClientError) {
          setEvidenceCreateState({
            type: "error",
            message: error.message,
            requestId: error.requestId,
          });
        } else {
          setEvidenceCreateState({
            type: "error",
            message: "新增候选证据失败，请稍后重试。",
          });
        }
      } finally {
        setIsCreatingEvidence(false);
      }
    },
    [evidenceForm, loadTree, selectedNode],
  );

  const handleReviewEvidence = useCallback(
    async (evidence: AbilityEvidence, status: "confirmed" | "rejected") => {
      if (!selectedNode) {
        setEvidenceActionState({ type: "error", message: "请先选择一个能力节点。" });
        return;
      }

      setActiveEvidenceActionId(evidence.id);
      setActiveEvidenceActionType(status === "confirmed" ? "confirm" : "reject");
      setEvidenceActionState({ type: "idle" });

      try {
        const response = await reviewAbilityEvidence(evidence.id, { status });
        setEvidenceActionState({
          type: "success",
          message:
            status === "confirmed"
              ? "候选证据已确认并正式挂载。"
              : "候选证据已拒绝，不再作为正式挂载证据。",
          requestId: response.requestId,
        });
        await loadTree(selectedNode.id);
      } catch (error) {
        if (error instanceof ApiClientError) {
          setEvidenceActionState({
            type: "error",
            message: error.message,
            requestId: error.requestId,
          });
        } else {
          setEvidenceActionState({
            type: "error",
            message: "证据审核失败，请稍后重试。",
          });
        }
      } finally {
        setActiveEvidenceActionId(null);
        setActiveEvidenceActionType(null);
      }
    },
    [loadTree, selectedNode],
  );

  const handleDeleteEvidence = useCallback(
    async (evidence: AbilityEvidence) => {
      if (!selectedNode) {
        setEvidenceActionState({ type: "error", message: "请先选择一个能力节点。" });
        return;
      }

      const confirmed = window.confirm(`确认删除这条证据吗？\n\n${evidence.content}`);

      if (!confirmed) {
        return;
      }

      setActiveEvidenceActionId(evidence.id);
      setActiveEvidenceActionType("delete");
      setEvidenceActionState({ type: "idle" });

      try {
        const response = await deleteAbilityEvidence(evidence.id);
        setEvidenceActionState({
          type: "success",
          message: "证据已删除，当前节点与能力树已刷新。",
          requestId: response.requestId,
        });
        await loadTree(selectedNode.id);
      } catch (error) {
        if (error instanceof ApiClientError) {
          setEvidenceActionState({
            type: "error",
            message: error.message,
            requestId: error.requestId,
          });
        } else {
          setEvidenceActionState({
            type: "error",
            message: "删除证据失败，请稍后重试。",
          });
        }
      } finally {
        setActiveEvidenceActionId(null);
        setActiveEvidenceActionType(null);
      }
    },
    [loadTree, selectedNode],
  );

  return (
    <div className="mx-auto max-w-[1440px] space-y-8">
      <PageHeader
        eyebrow="能力树"
        title="能力节点与证据挂载"
        description="能力树已接入真实 AbilityNode API。当前支持节点新增、查看、编辑、移动、删除，以及候选能力证据的新增、确认、拒绝和删除。"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => void loadTree()} disabled={isLoading}>
              {isLoading ? "刷新中..." : "刷新能力树"}
            </Button>
            <Button asChild variant="secondary">
              <Link href="/weekly-review">查看每周复盘</Link>
            </Button>
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <SectionCard
          title="能力树目录"
          eyebrow="Nodes"
          description="左侧展示真实多层节点。点击任意节点后，右侧可查看详情、编辑、移动或删除。"
        >
          {loadError ? (
            <StateBlock
              title="能力树加载失败"
              description={loadError}
              action={
                <Button type="button" size="sm" onClick={() => void loadTree()}>
                  重试
                </Button>
              }
            />
          ) : isLoading && treeNodes.length === 0 ? (
            <StateBlock title="正在加载能力树" description="正在从真实 API 读取能力节点，请稍候。" />
          ) : treeNodes.length === 0 ? (
            <StateBlock
              title="还没有能力节点"
              description="当前尚未创建任何节点。你可以先在右侧创建一个根节点，后续再逐层扩展。"
            />
          ) : (
            <div className="space-y-3">
              {treeNodes.map((node) => (
                <AbilityTreeBranch
                  key={node.id}
                  node={node}
                  selectedNodeId={selectedNodeId}
                  onSelect={handleSelectNode}
                />
              ))}
            </div>
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title={selectedNode?.name ?? "节点详情"}
            eyebrow="Detail"
            description={
              selectedNode
                ? "右侧详情由真实节点接口返回。新增的是候选能力证据，确认后才会正式挂载归档。"
                : "请选择左侧节点查看详情。"
            }
            actions={
              selectedNode ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteNode}
                  disabled={isDeleting}
                >
                  {isDeleting ? "删除中..." : "删除节点"}
                </Button>
              ) : null
            }
          >
            {loadError ? (
              <StateBlock
                title="当前无法展示节点详情"
                description="能力树尚未成功加载，详情面板已暂停。"
              />
            ) : isLoading && !selectedNode ? (
              <StateBlock title="正在准备详情" description="能力树加载完成后会自动显示第一个节点详情。" />
            ) : !selectedNode ? (
              <StateBlock title="还没有选中节点" description="从左侧选择一个节点，或先创建一个根节点。" />
            ) : (
              <div className="space-y-4">
                {detailError ? (
                  <InlineNotice tone="warning" message={detailError} />
                ) : null}
                {deleteState.type !== "idle" ? (
                  <InlineNotice
                    tone={deleteState.type === "success" ? "success" : "error"}
                    message={formatActionMessage(deleteState)}
                  />
                ) : null}

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-4">
                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                        描述
                      </p>
                      <p className="mt-3 text-sm leading-7 text-foreground">
                        {selectedNode.description?.trim() || "当前还没有填写描述。"}
                      </p>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-medium text-foreground">子节点</p>
                      {selectedNode.children.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedNode.children.map((child) => (
                            <button
                              key={child.id}
                              type="button"
                              onClick={() => void handleSelectNode(child)}
                              className="rounded-full border border-white/10 bg-background/50 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
                            >
                              {child.name}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-muted-foreground">当前没有子节点。</p>
                      )}
                    </div>

                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">证据挂载</p>
                        {isDetailLoading ? (
                          <span className="text-xs text-muted-foreground">详情刷新中...</span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        新增的是候选能力证据，确认后才会正式挂载归档到当前能力节点。
                      </p>
                      {evidenceActionState.type !== "idle" ? (
                        <div className="mt-3">
                          <InlineNotice
                            tone={evidenceActionState.type === "success" ? "success" : "error"}
                            message={formatActionMessage(evidenceActionState)}
                          />
                        </div>
                      ) : null}
                      {selectedNode.evidenceItems.length > 0 ? (
                        <div className="mt-3 space-y-3">
                          {selectedNode.evidenceItems.map((item) => (
                            <article
                              key={item.id}
                              className="rounded-lg border border-white/10 bg-background/50 p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <EvidenceStatusBadge status={item.status} />
                                <div className="flex flex-wrap gap-2">
                                  {item.status === "candidate" ? (
                                    <>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => void handleReviewEvidence(item, "confirmed")}
                                        disabled={activeEvidenceActionId === item.id}
                                      >
                                        {activeEvidenceActionId === item.id &&
                                        activeEvidenceActionType === "confirm"
                                          ? "确认中..."
                                          : "确认"}
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => void handleReviewEvidence(item, "rejected")}
                                        disabled={activeEvidenceActionId === item.id}
                                      >
                                        {activeEvidenceActionId === item.id &&
                                        activeEvidenceActionType === "reject"
                                          ? "拒绝中..."
                                          : "拒绝"}
                                      </Button>
                                    </>
                                  ) : null}
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => void handleDeleteEvidence(item)}
                                    disabled={activeEvidenceActionId === item.id}
                                  >
                                    {activeEvidenceActionId === item.id &&
                                    activeEvidenceActionType === "delete"
                                      ? "删除中..."
                                      : "删除"}
                                  </Button>
                                </div>
                              </div>

                              <p className="mt-3 text-sm leading-6 text-foreground">{item.content}</p>

                              <dl className="mt-4 grid gap-3 text-sm text-foreground sm:grid-cols-2 xl:grid-cols-3">
                                <MetaTile
                                  label="影响方向"
                                  value={abilityEvidenceImpactLabelMap[item.impact]}
                                />
                                <MetaTile
                                  label="难度分"
                                  value={String(item.difficultyScore)}
                                />
                                <MetaTile
                                  label="独立性分"
                                  value={String(item.independenceScore)}
                                />
                                <MetaTile
                                  label="影响力分"
                                  value={String(item.impactScore)}
                                />
                                <MetaTile
                                  label="反馈分"
                                  value={String(item.feedbackScore)}
                                />
                                <MetaTile
                                  label="重复次数"
                                  value={String(item.recurrenceCount)}
                                />
                              </dl>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-lg border border-dashed border-white/10 bg-background/40 p-4">
                          <p className="text-sm leading-6 text-muted-foreground">
                            当前节点还没有任何能力证据。你可以先新增候选证据，确认后再正式挂载归档。
                          </p>
                        </div>
                      )}

                      <div className="mt-4 border-t border-white/10 pt-4">
                        <p className="text-sm font-medium text-foreground">新增候选证据</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          这里只能新增候选能力证据，不提供直接写入已确认状态的入口。
                        </p>

                        <form className="mt-4 space-y-4" onSubmit={handleCreateEvidence}>
                          <div className="space-y-2">
                            <label
                              className="text-sm font-medium text-foreground"
                              htmlFor="ability-evidence-content"
                            >
                              证据内容
                            </label>
                            <textarea
                              id="ability-evidence-content"
                              value={evidenceForm.content}
                              onChange={(event) =>
                                setEvidenceForm((current) => ({
                                  ...current,
                                  content: event.target.value,
                                }))
                              }
                              className="min-h-28 w-full rounded-lg border border-white/10 bg-background/50 px-4 py-3 text-sm leading-7 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                              placeholder="描述这条行为、结果或反馈，确认后才会正式归档到当前能力节点。"
                            />
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <FieldGroup label="影响方向" htmlFor="ability-evidence-impact">
                              <select
                                id="ability-evidence-impact"
                                value={evidenceForm.impact}
                                onChange={(event) =>
                                  setEvidenceForm((current) => ({
                                    ...current,
                                    impact: event.target.value as AbilityEvidenceImpact,
                                  }))
                                }
                                className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                              >
                                {abilityEvidenceImpactValues.map((impact) => (
                                  <option key={impact} value={impact}>
                                    {abilityEvidenceImpactLabelMap[impact]}
                                  </option>
                                ))}
                              </select>
                            </FieldGroup>

                            <FieldGroup label="重复出现次数" htmlFor="ability-evidence-recurrence">
                              <input
                                id="ability-evidence-recurrence"
                                type="number"
                                min={1}
                                step={1}
                                value={evidenceForm.recurrenceCount}
                                onChange={(event) =>
                                  setEvidenceForm((current) => ({
                                    ...current,
                                    recurrenceCount: Number(event.target.value) || 1,
                                  }))
                                }
                                className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                              />
                            </FieldGroup>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <FieldGroup label="难度分" htmlFor="ability-evidence-difficulty">
                              <ScoreSelect
                                id="ability-evidence-difficulty"
                                value={evidenceForm.difficultyScore}
                                options={evidenceScoreOptions}
                                onChange={(value) =>
                                  setEvidenceForm((current) => ({
                                    ...current,
                                    difficultyScore: value,
                                  }))
                                }
                              />
                            </FieldGroup>

                            <FieldGroup label="独立性分" htmlFor="ability-evidence-independence">
                              <ScoreSelect
                                id="ability-evidence-independence"
                                value={evidenceForm.independenceScore}
                                options={evidenceScoreOptions}
                                onChange={(value) =>
                                  setEvidenceForm((current) => ({
                                    ...current,
                                    independenceScore: value,
                                  }))
                                }
                              />
                            </FieldGroup>

                            <FieldGroup label="影响力分" htmlFor="ability-evidence-impact-score">
                              <ScoreSelect
                                id="ability-evidence-impact-score"
                                value={evidenceForm.impactScore}
                                options={evidenceScoreOptions}
                                onChange={(value) =>
                                  setEvidenceForm((current) => ({
                                    ...current,
                                    impactScore: value,
                                  }))
                                }
                              />
                            </FieldGroup>

                            <FieldGroup label="反馈分" htmlFor="ability-evidence-feedback">
                              <ScoreSelect
                                id="ability-evidence-feedback"
                                value={evidenceForm.feedbackScore}
                                options={feedbackScoreOptions}
                                onChange={(value) =>
                                  setEvidenceForm((current) => ({
                                    ...current,
                                    feedbackScore: value,
                                  }))
                                }
                              />
                            </FieldGroup>
                          </div>

                          {evidenceCreateState.type !== "idle" ? (
                            <InlineNotice
                              tone={evidenceCreateState.type === "success" ? "success" : "error"}
                              message={formatActionMessage(evidenceCreateState)}
                            />
                          ) : null}

                          <Button type="submit" disabled={isCreatingEvidence}>
                            {isCreatingEvidence ? "提交中..." : "新增候选证据"}
                          </Button>
                        </form>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
                      <p className="text-sm font-medium text-foreground">节点元信息</p>
                      <dl className="mt-4 space-y-3 text-sm text-foreground">
                        <MetaRow label="名称" value={selectedNode.name} />
                        <MetaRow label="层级" value={`L${selectedNode.level}`} />
                        <MetaRow label="来源" value={originLabelMap[selectedNode.origin]} />
                        <MetaRow
                          label="父节点"
                          value={selectedNode.parentId ? "已挂在上级节点下" : "根节点"}
                        />
                        <MetaRow label="子节点数" value={String(selectedNode.children.length)} />
                        <MetaRow
                          label="证据数"
                          value={String(selectedNode.evidenceItems.length)}
                        />
                      </dl>
                    </div>

                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
                      <p className="text-sm font-medium text-foreground">删除行为提示</p>
                      <p className="mt-3 text-sm leading-6 text-foreground/90">
                        当前后端删除遵循现有 schema 行为，节点删除后，其后代节点可能被重新挂到上层或根级。更细的业务规则后续再补。
                      </p>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-medium text-foreground">当前接入状态</p>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        当前已接通节点新增、编辑、移动、删除，以及候选能力证据的新增、确认、拒绝和删除。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          <section className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              title="新增节点"
              eyebrow="Create"
              description="可以先创建根节点；如果当前已选中节点，也可以勾选后直接作为其子节点创建。"
            >
              <form className="space-y-4" onSubmit={handleCreateNode}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="ability-node-name">
                    节点名称
                  </label>
                  <input
                    id="ability-node-name"
                    type="text"
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                    className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                    placeholder="例如：结构化表达"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-foreground"
                    htmlFor="ability-node-description"
                  >
                    描述
                  </label>
                  <textarea
                    id="ability-node-description"
                    value={createDescription}
                    onChange={(event) => setCreateDescription(event.target.value)}
                    className="min-h-28 w-full rounded-lg border border-white/10 bg-background/50 px-4 py-3 text-sm leading-7 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                    placeholder="补充这个能力节点的含义、边界或期望表现。"
                  />
                </div>

                <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-background/40 px-4 py-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={createAsChild}
                    disabled={!selectedNode}
                    onChange={(event) => setCreateAsChild(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-background/50"
                  />
                  <span className="leading-6">
                    {selectedNode
                      ? `作为当前节点「${selectedNode.name}」的子节点创建`
                      : "请先选中一个节点，才能创建其子节点"}
                  </span>
                </label>

                <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
                  当前将创建
                  <span className="font-medium text-foreground">
                    {createAsChild && selectedNode ? `「${selectedNode.name}」下的子节点` : "根节点"}
                  </span>
                  。
                </div>

                {createState.type !== "idle" ? (
                  <InlineNotice
                    tone={createState.type === "success" ? "success" : "error"}
                    message={formatActionMessage(createState)}
                  />
                ) : null}

                <Button type="submit" disabled={isCreating}>
                  {isCreating ? "创建中..." : "创建节点"}
                </Button>
              </form>
            </SectionCard>

            <SectionCard
              title="编辑与移动"
              eyebrow="Update"
              description="选中节点后可修改名称、描述和父节点。父节点选择已规避自身与后代节点。"
            >
              {!selectedNode ? (
                <StateBlock
                  title="还没有可编辑节点"
                  description="先从左侧选择一个节点，再编辑名称、描述或移动位置。"
                />
              ) : (
                <form className="space-y-4" onSubmit={handleUpdateNode}>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="edit-node-name">
                      节点名称
                    </label>
                    <input
                      id="edit-node-name"
                      type="text"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium text-foreground"
                      htmlFor="edit-node-description"
                    >
                      描述
                    </label>
                    <textarea
                      id="edit-node-description"
                      value={editDescription}
                      onChange={(event) => setEditDescription(event.target.value)}
                      className="min-h-28 w-full rounded-lg border border-white/10 bg-background/50 px-4 py-3 text-sm leading-7 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                      placeholder="留空将把描述更新为空。"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="move-parent-id">
                      移动到父节点
                    </label>
                    <select
                      id="move-parent-id"
                      value={moveParentId}
                      onChange={(event) => setMoveParentId(event.target.value)}
                      className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                    >
                      {moveOptions.map((option) => (
                        <option key={option.id ?? "root"} value={option.id ?? "root"} disabled={option.disabled}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs leading-6 text-muted-foreground">
                      已避开当前节点和其后代节点；如果后端仍拒绝移动，页面会直接显示接口返回的原因。
                    </p>
                  </div>

                  {updateState.type !== "idle" ? (
                    <InlineNotice
                      tone={updateState.type === "success" ? "success" : "error"}
                      message={formatActionMessage(updateState)}
                    />
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={isUpdating}>
                      {isUpdating ? "保存中..." : "保存修改"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setEditName(selectedNode.name);
                        setEditDescription(selectedNode.description ?? "");
                        setMoveParentId(selectedNode.parentId ?? "root");
                        setUpdateState({ type: "idle" });
                      }}
                      disabled={isUpdating}
                    >
                      恢复当前值
                    </Button>
                  </div>
                </form>
              )}
            </SectionCard>
          </section>
        </div>
      </section>
    </div>
  );
}

function AbilityTreeBranch({
  node,
  selectedNodeId,
  onSelect,
}: {
  node: AbilityNodeDetail;
  selectedNodeId: string | null;
  onSelect: (node: AbilityNodeDetail) => Promise<void>;
}) {
  const isActive = node.id === selectedNodeId;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void onSelect(node)}
        className={
          isActive
            ? "w-full rounded-lg border border-primary/20 bg-primary/10 p-4 text-left transition"
            : "w-full rounded-lg border border-white/10 bg-white/5 p-4 text-left transition hover:border-primary/20 hover:bg-white/8"
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{node.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              L{node.level} · {originLabelMap[node.origin]}
            </p>
          </div>
          {isActive ? <span className="text-xs text-primary">当前查看</span> : null}
        </div>
      </button>

      {node.children.length > 0 ? (
        <div className="ml-4 space-y-2 border-l border-white/10 pl-3">
          {node.children.map((child) => (
            <AbilityTreeBranch
              key={child.id}
              node={child}
              selectedNodeId={selectedNodeId}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StateBlock({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-background/40 p-5">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function InlineNotice({
  tone,
  message,
}: {
  tone: "success" | "error" | "warning";
  message: string;
}) {
  const toneClassName =
    tone === "success"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
      : tone === "warning"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-100"
        : "border-rose-500/20 bg-rose-500/10 text-rose-100";

  return (
    <div className={`rounded-lg border p-4 text-sm leading-6 ${toneClassName}`}>
      {message}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-2 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function FieldGroup({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ScoreSelect({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: number;
  options: number[];
  onChange: (value: number) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function EvidenceStatusBadge({
  status,
}: {
  status: AbilityEvidence["status"];
}) {
  const toneClassName =
    status === "confirmed"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
      : status === "rejected"
        ? "border-rose-500/20 bg-rose-500/10 text-rose-100"
        : "border-amber-500/20 bg-amber-500/10 text-amber-100";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${toneClassName}`}>
      {abilityEvidenceStatusLabelMap[status]}
    </span>
  );
}

function formatActionMessage(state: Exclude<ActionState, { type: "idle" }>) {
  return `${state.message}${state.requestId ? `（requestId: ${state.requestId}）` : ""}`;
}

function buildNumberRange(min: number, max: number) {
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

function findAbilityNodeById(
  nodes: AbilityNodeDetail[],
  targetId: string,
): AbilityNodeDetail | null {
  for (const node of nodes) {
    if (node.id === targetId) {
      return node;
    }

    const match = findAbilityNodeById(node.children, targetId);

    if (match) {
      return match;
    }
  }

  return null;
}

function resolveSelectedNodeId(
  nodes: AbilityNodeDetail[],
  preferredId?: string | null,
): string | null {
  if (preferredId && findAbilityNodeById(nodes, preferredId)) {
    return preferredId;
  }

  return findFirstAbilityNode(nodes)?.id ?? null;
}

function findFirstAbilityNode(nodes: AbilityNodeDetail[]): AbilityNodeDetail | null {
  return nodes[0] ?? null;
}

function buildMoveOptions(
  nodes: AbilityNodeDetail[],
  selectedNodeId: string | null,
): MoveOption[] {
  const descendants = selectedNodeId
    ? new Set(collectDescendantIds(nodes, selectedNodeId))
    : new Set<string>();
  const options: MoveOption[] = [
    {
      id: null,
      label: "设为根节点",
      disabled: false,
    },
  ];

  appendMoveOptions(nodes, options, descendants, selectedNodeId, 0);

  return options;
}

function appendMoveOptions(
  nodes: AbilityNodeDetail[],
  options: MoveOption[],
  descendants: Set<string>,
  selectedNodeId: string | null,
  depth: number,
) {
  for (const node of nodes) {
    options.push({
      id: node.id,
      label: depth > 0 ? `${"| ".repeat(depth)}${node.name}` : node.name,
      disabled: node.id === selectedNodeId || descendants.has(node.id),
    });

    appendMoveOptions(node.children, options, descendants, selectedNodeId, depth + 1);
  }
}

function collectDescendantIds(
  nodes: AbilityNodeDetail[],
  rootId: string,
): string[] {
  const rootNode = findAbilityNodeById(nodes, rootId);

  if (!rootNode) {
    return [];
  }

  const ids: string[] = [];
  const stack = [...rootNode.children];

  while (stack.length > 0) {
    const current = stack.pop();

    if (!current) {
      continue;
    }

    ids.push(current.id);
    stack.push(...current.children);
  }

  return ids;
}
