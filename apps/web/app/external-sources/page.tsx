"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { PageHeader } from "@/components/shell/page-header";
import { SectionCard } from "@/components/shell/section-card";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api-client";
import { createDecisionEvidence } from "@/lib/decision-evidence";
import {
  createExternalSourceImpactDraft,
  createExternalSource,
  deleteExternalSource,
  externalSourceSearchCategoryValues,
  listExternalSources,
  searchExternalSources,
  updateExternalSource,
  type ExternalSourceSearchCategory,
  type ExternalSourceImpactDraftItem,
  type ExternalSourceImpactDraftResponse,
  type ExternalSource,
  type SearchExternalSourcesResponse,
} from "@/lib/external-sources";
import { listLifeDecisions, type LifeDecision } from "@/lib/life-decisions";
import { cn } from "@/lib/utils";

const listLimit = 50;

type ActionState =
  | { type: "idle" }
  | { type: "success"; message: string; requestId?: string }
  | { type: "error"; message: string; requestId?: string };

type BusyAction =
  | {
      id: string;
      kind: "attach" | "clear" | "delete";
    }
  | null;

type FormState = {
  title: string;
  sourceSite: string;
  url: string;
  summary: string;
  relationToDecision: string;
  publishedDate: string;
  associateActive: boolean;
};

type SearchFormState = {
  query: string;
  category: ExternalSourceSearchCategory;
  limit: string;
  associateActive: boolean;
};

type ConfirmedImpactEvidenceRecord = {
  draftKey: string;
  evidenceId: string;
  sourceCitationId?: string | null;
  pathId: string;
  pathTitle: string;
  evidenceType: ExternalSourceImpactDraftItem["evidenceType"];
  weight?: number | null;
  content: string;
  externalSourceTitle: string;
  sourceSite: string;
  url: string;
  createdAt: string;
};

const defaultFormState: FormState = {
  title: "",
  sourceSite: "",
  url: "",
  summary: "",
  relationToDecision: "",
  publishedDate: "",
  associateActive: false,
};

const defaultSearchFormState: SearchFormState = {
  query: "",
  category: "ai_role",
  limit: "3",
  associateActive: true,
};

const searchCategoryLabelMap: Record<ExternalSourceSearchCategory, string> = {
  ai_role: "AI 应用岗位",
  job_market: "广州深圳行情",
  industry: "行业趋势",
  postgraduate: "华师外国哲学",
  other: "其他",
};

export default function ExternalSourcesPage() {
  const [sources, setSources] = useState<ExternalSource[]>([]);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [searchForm, setSearchForm] = useState<SearchFormState>(defaultSearchFormState);
  const [lastSearchResult, setLastSearchResult] =
    useState<SearchExternalSourcesResponse | null>(null);
  const [impactDraft, setImpactDraft] = useState<ExternalSourceImpactDraftResponse | null>(
    null,
  );
  const [selectedDraftSourceIds, setSelectedDraftSourceIds] = useState<string[]>([]);
  const [confirmedImpactEvidence, setConfirmedImpactEvidence] = useState<
    ConfirmedImpactEvidenceRecord[]
  >([]);
  const [activeDecision, setActiveDecision] = useState<LifeDecision | null>(null);
  const [activeDecisionCount, setActiveDecisionCount] = useState(0);
  const [isSourcesLoading, setIsSourcesLoading] = useState(true);
  const [isDecisionLoading, setIsDecisionLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isGeneratingImpactDraft, setIsGeneratingImpactDraft] = useState(false);
  const [confirmingDraftKey, setConfirmingDraftKey] = useState<string | null>(null);
  const [confirmedDraftKeys, setConfirmedDraftKeys] = useState<string[]>([]);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [sourcesLoadError, setSourcesLoadError] = useState<string | null>(null);
  const [decisionLoadError, setDecisionLoadError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>({ type: "idle" });
  const formAssociationDirtyRef = useRef(false);
  const searchAssociationDirtyRef = useRef(false);

  const loadSources = useCallback(async () => {
    setIsSourcesLoading(true);
    setSourcesLoadError(null);

    try {
      const response = await listExternalSources({ limit: listLimit, offset: 0 });
      setSources(response.data.items);
      setTotal(response.data.pagination.total);
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? `${error.message}${error.requestId ? `（requestId: ${error.requestId}）` : ""}`
          : "当前无法读取外部来源，请确认后端服务已启动。";

      setSources([]);
      setTotal(0);
      setSourcesLoadError(message);
    } finally {
      setIsSourcesLoading(false);
    }
  }, []);

  const loadActiveDecision = useCallback(async () => {
    setIsDecisionLoading(true);
    setDecisionLoadError(null);

    try {
      const response = await listLifeDecisions({ status: "active" });
      const nextActiveDecision = response.data[0] ?? null;
      const shouldUseActiveAssociation = Boolean(nextActiveDecision);
      if (!nextActiveDecision) {
        formAssociationDirtyRef.current = false;
        searchAssociationDirtyRef.current = false;
      }
      setActiveDecision(nextActiveDecision);
      setActiveDecisionCount(response.data.length);
      setForm((current) =>
        !formAssociationDirtyRef.current || !nextActiveDecision
          ? {
              ...current,
              associateActive: shouldUseActiveAssociation,
            }
          : current,
      );
      setSearchForm((current) =>
        !searchAssociationDirtyRef.current || !nextActiveDecision
          ? {
              ...current,
              associateActive: shouldUseActiveAssociation,
            }
          : current,
      );
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? `${error.message}${error.requestId ? `（requestId: ${error.requestId}）` : ""}`
          : "当前无法读取 active LifeDecision，新增时暂时只能登记未关联来源。";

      setActiveDecision(null);
      setActiveDecisionCount(0);
      formAssociationDirtyRef.current = false;
      searchAssociationDirtyRef.current = false;
      setForm((current) => ({
        ...current,
        associateActive: false,
      }));
      setSearchForm((current) => ({
        ...current,
        associateActive: false,
      }));
      setDecisionLoadError(message);
    } finally {
      setIsDecisionLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSources();
    void loadActiveDecision();
  }, [loadActiveDecision, loadSources]);

  const linkedToActiveCount = useMemo(
    () =>
      activeDecision ? sources.filter((source) => source.lifeDecisionId === activeDecision.id).length : 0,
    [activeDecision, sources],
  );

  const activeDecisionSourceIds = useMemo(
    () =>
      activeDecision
        ? sources
            .filter((source) => source.lifeDecisionId === activeDecision.id)
            .map((source) => source.id)
        : [],
    [activeDecision, sources],
  );

  const activeDecisionSources = useMemo(
    () =>
      activeDecision
        ? sources.filter((source) => source.lifeDecisionId === activeDecision.id)
        : [],
    [activeDecision, sources],
  );

  const unattachedCount = useMemo(
    () => sources.filter((source) => !source.lifeDecisionId).length,
    [sources],
  );
  const isConfirmingAnyDraft = confirmingDraftKey !== null;
  const isDraftBusy = isGeneratingImpactDraft || isConfirmingAnyDraft;

  useEffect(() => {
    setSelectedDraftSourceIds((current) => {
      const allowedIds = new Set(activeDecisionSourceIds);
      const nextSelected = current.filter((id) => allowedIds.has(id));

      if (nextSelected.length > 0) {
        return nextSelected;
      }

      return activeDecisionSourceIds;
    });
  }, [activeDecisionSourceIds]);

  const handleFormChange = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((current) => ({
        ...current,
        [key]: value,
      }));
    },
    [],
  );

  const handleSearchFormChange = useCallback(
    <K extends keyof SearchFormState>(key: K, value: SearchFormState[K]) => {
      setSearchForm((current) => ({
        ...current,
        [key]: value,
      }));
    },
    [],
  );

  const handleSearchSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const query = searchForm.query.trim();
      const limit = Number(searchForm.limit);

      if (!query) {
        setActionState({
          type: "error",
          message: "请先填写外部信息搜索词。",
        });
        return;
      }

      if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
        setActionState({
          type: "error",
          message: "搜索结果数量需要是 1 到 10 之间的整数。",
        });
        return;
      }

      setIsSearching(true);
      setActionState({ type: "idle" });

      try {
        const response = await searchExternalSources({
          query,
          category: searchForm.category,
          limit,
          lifeDecisionId:
            searchForm.associateActive && activeDecision ? activeDecision.id : undefined,
        });
        const savedIdsForActiveDecision = response.data.savedItems
          .filter((item) => item.lifeDecisionId === activeDecision?.id)
          .map((item) => item.id);

        setLastSearchResult(response.data);
        setImpactDraft(null);
        setConfirmedDraftKeys([]);
        setConfirmedImpactEvidence([]);
        setSelectedDraftSourceIds((current) =>
          Array.from(new Set([...current, ...savedIdsForActiveDecision])),
        );
        await loadSources();
        setActionState({
          type: "success",
          message:
            response.data.savedItems.length > 0
              ? `已保存 ${response.data.savedItems.length} 条搜索来源。请打开链接自行核对，系统只做 best-effort 搜索和 deterministic 摘要。`
              : "搜索完成但没有保存到可用结果。请换一个关键词或稍后重试。",
          requestId: response.requestId,
        });
      } catch (error) {
        setActionState({
          type: "error",
          message:
            error instanceof ApiClientError
              ? error.message
              : "外部信息搜索失败，请稍后重试或改用手动登记。",
          requestId: error instanceof ApiClientError ? error.requestId : undefined,
        });
      } finally {
        setIsSearching(false);
      }
    },
    [activeDecision, loadSources, searchForm],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const title = form.title.trim();
      const sourceSite = form.sourceSite.trim();
      const url = form.url.trim();

      if (!title || !sourceSite || !url) {
        setActionState({
          type: "error",
          message: "请先填写标题、来源站点和 URL。",
        });
        return;
      }

      setIsCreating(true);
      setActionState({ type: "idle" });

      try {
        const response = await createExternalSource({
          title,
          sourceSite,
          url,
          summary: normalizeOptionalText(form.summary),
          relationToDecision: normalizeOptionalText(form.relationToDecision),
          publishedAt: normalizePublishedDate(form.publishedDate) ?? undefined,
          lifeDecisionId:
            form.associateActive && activeDecision ? activeDecision.id : undefined,
        });

        setSources((current) => [response.data, ...current].slice(0, listLimit));
        setTotal((current) => current + 1);
        setImpactDraft(null);
        setConfirmedDraftKeys([]);
        setConfirmedImpactEvidence([]);
        if (response.data.lifeDecisionId === activeDecision?.id) {
          setSelectedDraftSourceIds((current) =>
            Array.from(new Set([...current, response.data.id])),
          );
        }
        formAssociationDirtyRef.current = false;
        setForm({
          ...defaultFormState,
          associateActive: Boolean(activeDecision),
        });
        setActionState({
          type: "success",
          message: "已登记新的外部来源。当前页面只做手动登记，不会触发真实联网搜索。",
          requestId: response.requestId,
        });
      } catch (error) {
        setActionState({
          type: "error",
          message: error instanceof ApiClientError ? error.message : "新增失败，请稍后重试。",
          requestId: error instanceof ApiClientError ? error.requestId : undefined,
        });
      } finally {
        setIsCreating(false);
      }
    },
    [activeDecision, form],
  );

  const handleDelete = useCallback(async (source: ExternalSource) => {
    setBusyAction({ id: source.id, kind: "delete" });
    setActionState({ type: "idle" });

    try {
      const response = await deleteExternalSource(source.id);
      setSources((current) => current.filter((item) => item.id !== source.id));
      setTotal((current) => Math.max(current - 1, 0));
      setImpactDraft(null);
      setConfirmedDraftKeys([]);
      setConfirmedImpactEvidence([]);
      setSelectedDraftSourceIds((current) => current.filter((id) => id !== source.id));
      setActionState({
        type: "success",
        message: `已删除「${source.title}」。`,
        requestId: response.requestId,
      });
    } catch (error) {
      setActionState({
        type: "error",
        message: error instanceof ApiClientError ? error.message : "删除失败，请稍后重试。",
        requestId: error instanceof ApiClientError ? error.requestId : undefined,
      });
    } finally {
      setBusyAction(null);
    }
  }, []);

  const handleUpdateLifeDecision = useCallback(
    async (source: ExternalSource, lifeDecisionId: string | null) => {
      const kind = lifeDecisionId ? "attach" : "clear";
      setBusyAction({ id: source.id, kind });
      setActionState({ type: "idle" });

      try {
        const response = await updateExternalSource(source.id, { lifeDecisionId });
        setSources((current) =>
          current.map((item) => (item.id === source.id ? response.data : item)),
        );
        setImpactDraft(null);
        setConfirmedDraftKeys([]);
        setConfirmedImpactEvidence([]);
        setSelectedDraftSourceIds((current) =>
          response.data.lifeDecisionId === activeDecision?.id
            ? Array.from(new Set([...current, response.data.id]))
            : current.filter((id) => id !== response.data.id),
        );
        setActionState({
          type: "success",
          message: lifeDecisionId
            ? `已把「${source.title}」关联到当前 active decision。`
            : `已清空「${source.title}」的人生节点关联。`,
          requestId: response.requestId,
        });
      } catch (error) {
        setActionState({
          type: "error",
          message: error instanceof ApiClientError ? error.message : "关联更新失败，请稍后重试。",
          requestId: error instanceof ApiClientError ? error.requestId : undefined,
        });
      } finally {
        setBusyAction(null);
      }
    },
    [activeDecision?.id],
  );

  const handleGenerateImpactDraft = useCallback(async () => {
    if (!activeDecision) {
      setActionState({
        type: "error",
        message: "当前没有 active LifeDecision，无法生成路径影响草稿。",
      });
      return;
    }

    if (selectedDraftSourceIds.length === 0) {
      setActionState({
        type: "error",
        message: "请先选择至少一条已保存且已关联当前节点的外部来源。",
      });
      return;
    }

    setIsGeneratingImpactDraft(true);
    setImpactDraft(null);
    setConfirmedDraftKeys([]);
    setConfirmedImpactEvidence([]);
    setActionState({ type: "idle" });

    try {
      const response = await createExternalSourceImpactDraft({
        lifeDecisionId: activeDecision.id,
        externalSourceIds: selectedDraftSourceIds,
        maxItems: 8,
      });

      setImpactDraft(response.data);
      setActionState({
        type: "success",
        message:
          response.data.items.length > 0
            ? `已生成 ${response.data.items.length} 条路径影响草稿。草稿不会自动写入证据，需要你逐条确认。`
            : "已完成分析，但当前来源或路径不足以生成候选草稿。",
        requestId: response.requestId,
      });
    } catch (error) {
      setActionState({
        type: "error",
        message:
          error instanceof ApiClientError
            ? error.message
            : "生成路径影响草稿失败，请稍后重试。",
        requestId: error instanceof ApiClientError ? error.requestId : undefined,
      });
    } finally {
      setIsGeneratingImpactDraft(false);
    }
  }, [activeDecision, selectedDraftSourceIds]);

  const handleConfirmImpactDraft = useCallback(
    async (item: ExternalSourceImpactDraftItem) => {
      if (!activeDecision) {
        setActionState({
          type: "error",
          message: "当前没有 active LifeDecision，无法确认写入证据。",
        });
        return;
      }

      const draftKey = buildDraftKey(item);
      setConfirmingDraftKey(draftKey);
      setActionState({ type: "idle" });

      try {
        const response = await createDecisionEvidence({
          decisionId: activeDecision.id,
          pathId: item.pathId,
          evidenceType: item.evidenceType,
          content: item.suggestedContent,
          externalSourceId: item.externalSourceId,
          weight: item.suggestedWeight,
        });

        setConfirmedDraftKeys((current) => Array.from(new Set([...current, draftKey])));
        setConfirmedImpactEvidence((current) => {
          const nextRecord: ConfirmedImpactEvidenceRecord = {
            draftKey,
            evidenceId: response.data.id,
            sourceCitationId: response.data.sourceCitationId,
            pathId: item.pathId,
            pathTitle: item.pathTitle,
            evidenceType: item.evidenceType,
            weight: response.data.weight ?? item.suggestedWeight,
            content: response.data.content,
            externalSourceTitle: item.externalSourceTitle,
            sourceSite: item.sourceSite,
            url: item.url,
            createdAt: response.data.createdAt,
          };

          return [
            nextRecord,
            ...current.filter((record) => record.draftKey !== draftKey),
          ];
        });
        setActionState({
          type: "success",
          message: `已把「${item.externalSourceTitle}」确认写入路径「${item.pathTitle}」的正式决策证据，sourceCitationId：${response.data.sourceCitationId ?? "未返回"}`,
          requestId: response.requestId,
        });
      } catch (error) {
        setActionState({
          type: "error",
          message:
            error instanceof ApiClientError ? error.message : "确认写入证据失败，请稍后重试。",
          requestId: error instanceof ApiClientError ? error.requestId : undefined,
        });
      } finally {
        setConfirmingDraftKey(null);
      }
    },
    [activeDecision],
  );

  const handleToggleDraftSource = useCallback((sourceId: string, checked: boolean) => {
    setSelectedDraftSourceIds((current) =>
      checked
        ? Array.from(new Set([...current, sourceId]))
        : current.filter((id) => id !== sourceId),
    );
    setImpactDraft(null);
    setConfirmedDraftKeys([]);
    setConfirmedImpactEvidence([]);
    setActionState({ type: "idle" });
  }, []);

  return (
    <div className="mx-auto max-w-[1440px] space-y-8">
      <PageHeader
        eyebrow="外部信息"
        title="外部信息搜索与来源登记"
        description="用于搜索、保存和手动登记岗位、行业、学校或其他外部来源。搜索结果必须保留链接，摘要只做 deterministic 初步整理。"
        actions={
          <Button asChild variant="secondary">
            <Link href="/">回到决策工作台</Link>
          </Button>
        }
      />

      {actionState.type !== "idle" ? <FeedbackBanner state={actionState} /> : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)]">
        <div className="space-y-6">
          <SectionCard
            title="外部信息搜索"
            eyebrow="Search External Sources"
            description="第一版使用 best-effort web search；本地验收可切换 fake provider。结果保存为 ExternalSource，但不代表权威结论。"
          >
            <div className="space-y-4">
              <div className="rounded-lg border border-dashed border-sky-500/20 bg-sky-500/10 px-4 py-4 text-sm leading-6 text-foreground">
                搜索会保存标题、来源站点、URL 和 snippet 摘要。系统不会替你判断真伪，也不会把搜索摘要当作最终决策证据；重要信息需要打开原链接核对。
              </div>

              <form className="space-y-4" onSubmit={handleSearchSubmit}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="external-search-query">
                    搜索词
                  </label>
                  <input
                    id="external-search-query"
                    value={searchForm.query}
                    onChange={(event) => handleSearchFormChange("query", event.target.value)}
                    placeholder="例如：广州 AI 应用工程师 岗位要求"
                    className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="external-search-category">
                      搜索类别
                    </label>
                    <select
                      id="external-search-category"
                      value={searchForm.category}
                      onChange={(event) =>
                        handleSearchFormChange(
                          "category",
                          event.target.value as ExternalSourceSearchCategory,
                        )
                      }
                      className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                    >
                      {externalSourceSearchCategoryValues.map((category) => (
                        <option key={category} value={category}>
                          {searchCategoryLabelMap[category]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="external-search-limit">
                      保存数量
                    </label>
                    <input
                      id="external-search-limit"
                      type="number"
                      min={1}
                      max={10}
                      value={searchForm.limit}
                      onChange={(event) => handleSearchFormChange("limit", event.target.value)}
                      className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-background/40 px-4 py-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={searchForm.associateActive}
                    onChange={(event) => {
                      searchAssociationDirtyRef.current = true;
                      handleSearchFormChange("associateActive", event.target.checked);
                    }}
                    disabled={!activeDecision}
                    className="mt-0.5 h-4 w-4 rounded border-white/20 bg-background/50"
                  />
                  <span className="leading-6 text-muted-foreground">
                    搜索结果保存后关联当前 active decision
                    {activeDecision ? `：${activeDecision.title}` : "（当前没有可用节点）"}
                  </span>
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={isSearching || isDraftBusy}>
                    {isSearching ? "搜索中..." : "搜索并保存来源"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={isSearching || isDraftBusy}
                    onClick={() => {
                      searchAssociationDirtyRef.current = false;
                      setSearchForm({
                        ...defaultSearchFormState,
                        associateActive: Boolean(activeDecision),
                      });
                      setLastSearchResult(null);
                    }}
                  >
                    清空搜索
                  </Button>
                </div>
              </form>

              {lastSearchResult ? (
                <div className="space-y-3 rounded-lg border border-white/10 bg-background/45 px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <MetaBadge text={lastSearchResult.searchMode === "fake" ? "fake provider" : "best-effort"} tone="sky" />
                    <MetaBadge text={`保存 ${lastSearchResult.savedItems.length}`} tone="emerald" />
                    <MetaBadge text={`来源 ${lastSearchResult.sourceSnapshot.provider}`} />
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{lastSearchResult.summary}</p>
                  <div className="space-y-2">
                    {lastSearchResult.savedItems.map((item) => (
                      <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-primary underline-offset-4 hover:underline"
                      >
                        {item.title}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title="新增外部来源"
            eyebrow="Create External Source"
            description="手动填写来源信息后会直接写入 ExternalSource API，可选择顺手关联当前 active decision。"
          >
            <div className="space-y-4">
              <div className="rounded-lg border border-dashed border-amber-500/20 bg-amber-500/10 px-4 py-4 text-sm leading-6 text-foreground">
                你也可以手动登记外部来源，方便把岗位、行情、考研或其他线索挂进工作台。手动内容不会自动被模型判断，需要你自行维护摘要和决策关系。
              </div>

              <div className="rounded-lg border border-white/10 bg-background/45 px-4 py-4">
                <p className="text-sm font-medium text-foreground">当前 active 人生节点</p>
                {isDecisionLoading ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    正在读取 active LifeDecision...
                  </p>
                ) : decisionLoadError ? (
                  <p className="mt-2 text-sm text-muted-foreground">{decisionLoadError}</p>
                ) : activeDecision ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-medium text-foreground">{activeDecision.title}</p>
                    <p className="text-xs leading-6 text-muted-foreground">
                      新来源可一键关联到这条 active decision。
                      {activeDecisionCount > 1
                        ? ` 当前共检测到 ${activeDecisionCount} 条 active decision，页面默认使用第一条。`
                        : ""}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    当前没有 active LifeDecision。你仍然可以登记来源，稍后再手动关联。
                  </p>
                )}
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="source-title">
                    标题
                  </label>
                  <input
                    id="source-title"
                    value={form.title}
                    onChange={(event) => handleFormChange("title", event.target.value)}
                    placeholder="例如：某岗位 JD、某学校招生目录、某行业报告"
                    className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="source-site">
                      来源站点
                    </label>
                    <input
                      id="source-site"
                      value={form.sourceSite}
                      onChange={(event) => handleFormChange("sourceSite", event.target.value)}
                      placeholder="例如：BOSS 直聘、学校官网、公众号"
                      className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="source-date">
                      发布时间
                    </label>
                    <input
                      id="source-date"
                      type="date"
                      value={form.publishedDate}
                      onChange={(event) => handleFormChange("publishedDate", event.target.value)}
                      className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="source-url">
                    URL
                  </label>
                  <input
                    id="source-url"
                    type="url"
                    value={form.url}
                    onChange={(event) => handleFormChange("url", event.target.value)}
                    placeholder="https://example.com/source"
                    className="h-11 w-full rounded-lg border border-white/10 bg-background/50 px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="source-summary">
                    摘要
                  </label>
                  <textarea
                    id="source-summary"
                    value={form.summary}
                    onChange={(event) => handleFormChange("summary", event.target.value)}
                    placeholder="简要记录这条来源说了什么。"
                    className="min-h-28 w-full rounded-lg border border-white/10 bg-background/50 px-4 py-3 text-sm leading-7 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="source-relation">
                    与决策关系
                  </label>
                  <textarea
                    id="source-relation"
                    value={form.relationToDecision}
                    onChange={(event) =>
                      handleFormChange("relationToDecision", event.target.value)
                    }
                    placeholder="例如：更支持换工作路径，或提示考研时间线还需要补证据。"
                    className="min-h-24 w-full rounded-lg border border-white/10 bg-background/50 px-4 py-3 text-sm leading-7 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-background/40 px-4 py-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={form.associateActive}
                    onChange={(event) => {
                      formAssociationDirtyRef.current = true;
                      handleFormChange("associateActive", event.target.checked);
                    }}
                    disabled={!activeDecision}
                    className="mt-0.5 h-4 w-4 rounded border-white/20 bg-background/50"
                  />
                  <span className="leading-6 text-muted-foreground">
                    新增后立即关联当前 active decision
                    {activeDecision ? `：${activeDecision.title}` : "（当前没有可用节点）"}
                  </span>
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={isCreating || isDraftBusy}>
                    {isCreating ? "登记中..." : "登记来源"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={isCreating || isDraftBusy}
                    onClick={() => {
                      formAssociationDirtyRef.current = false;
                      setForm({
                        ...defaultFormState,
                        associateActive: Boolean(activeDecision),
                      });
                    }}
                  >
                    清空表单
                  </Button>
                </div>
              </form>
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="已登记来源"
          eyebrow="Registered Sources"
          description="列表来自 GET /api/external-sources。来源必须保留站点和 URL，方便后续回看。"
          actions={
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                void loadSources();
                void loadActiveDecision();
              }}
              disabled={
                isSourcesLoading ||
                isDecisionLoading ||
                isCreating ||
                isSearching ||
                busyAction !== null ||
                isDraftBusy
              }
            >
              刷新
            </Button>
          }
        >
          {sourcesLoadError ? <ErrorState message={sourcesLoadError} /> : null}

          {!sourcesLoadError && isSourcesLoading ? (
            <EmptyState text="正在读取已登记的外部来源..." />
          ) : null}

          {!sourcesLoadError && !isSourcesLoading && sources.length === 0 ? (
            <EmptyState text="当前还没有外部来源。你可以先搜索并保存来源，也可以手动登记。" />
          ) : null}

          {!sourcesLoadError && !isSourcesLoading && sources.length > 0 ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="已登记来源" value={`${total}`} helper={`本页展示前 ${sources.length} 条`} />
                <StatCard
                  label="关联当前节点"
                  value={`${linkedToActiveCount}`}
                  helper={activeDecision ? activeDecision.title : "当前无 active 节点"}
                />
                <StatCard label="未关联" value={`${unattachedCount}`} helper="可后续手动整理" />
              </div>

              <ImpactDraftPanel
                activeDecisionTitle={activeDecision?.title ?? null}
                availableSources={activeDecisionSources}
                selectedSourceIds={selectedDraftSourceIds}
                draft={impactDraft}
                confirmedEvidence={confirmedImpactEvidence}
                isGenerating={isGeneratingImpactDraft}
                isConfirmingAny={isConfirmingAnyDraft}
                confirmingDraftKey={confirmingDraftKey}
                confirmedDraftKeys={confirmedDraftKeys}
                onGenerate={() => void handleGenerateImpactDraft()}
                onConfirm={(item) => void handleConfirmImpactDraft(item)}
                onToggleSource={handleToggleDraftSource}
              />

              {sources.map((source) => {
                const isBoundToActive = activeDecision
                  ? source.lifeDecisionId === activeDecision.id
                  : false;
                const isBoundElsewhere = Boolean(source.lifeDecisionId) && !isBoundToActive;
                const isBusy = busyAction?.id === source.id;

                return (
                  <article
                    key={source.id}
                    className="rounded-xl border border-white/10 bg-white/5 p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold tracking-tight text-foreground">
                            {source.title}
                          </h2>
                          <span
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs font-medium",
                              isBoundToActive
                                ? "border-emerald-500/20 bg-emerald-500/10 text-foreground"
                                : isBoundElsewhere
                                  ? "border-sky-500/20 bg-sky-500/10 text-foreground"
                                  : "border-white/10 bg-background/50 text-muted-foreground",
                            )}
                          >
                            {isBoundToActive
                              ? "已关联当前人生节点"
                              : isBoundElsewhere
                                ? "已关联其他人生节点"
                                : "未关联人生节点"}
                          </span>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <InfoBlock label="来源站点" value={source.sourceSite} />
                          <div className="rounded-lg border border-white/10 bg-background/45 px-4 py-3">
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
                              URL
                            </p>
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 block break-all text-sm leading-6 text-primary underline-offset-4 transition hover:underline"
                            >
                              {source.url}
                            </a>
                          </div>
                          <InfoBlock
                            label="发布时间"
                            value={formatDate(source.publishedAt) ?? "未填写"}
                          />
                          <InfoBlock
                            label="登记时间"
                            value={formatDateTime(source.createdAt) ?? "未记录"}
                          />
                        </div>

                        <InfoBlock
                          label="与决策关系"
                          value={source.relationToDecision?.trim() || "暂未填写"}
                          multiline
                        />
                        <InfoBlock
                          label="摘要"
                          value={source.summary?.trim() || "暂未填写"}
                          multiline
                        />
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {activeDecision && !isBoundToActive ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={isBusy || isDraftBusy}
                            onClick={() =>
                              void handleUpdateLifeDecision(source, activeDecision.id)
                            }
                          >
                            {busyAction?.id === source.id && busyAction.kind === "attach"
                              ? "关联中..."
                              : "关联当前节点"}
                          </Button>
                        ) : null}

                        {source.lifeDecisionId ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={isBusy || isDraftBusy}
                            onClick={() => void handleUpdateLifeDecision(source, null)}
                          >
                            {busyAction?.id === source.id && busyAction.kind === "clear"
                              ? "清空中..."
                              : "清空关联"}
                          </Button>
                        ) : null}

                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
                          disabled={isBusy || isDraftBusy}
                          onClick={() => void handleDelete(source)}
                        >
                          {busyAction?.id === source.id && busyAction.kind === "delete"
                            ? "删除中..."
                            : "删除"}
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </SectionCard>
      </section>
    </div>
  );
}

function ImpactDraftPanel({
  activeDecisionTitle,
  availableSources,
  selectedSourceIds,
  draft,
  confirmedEvidence,
  isGenerating,
  isConfirmingAny,
  confirmingDraftKey,
  confirmedDraftKeys,
  onGenerate,
  onConfirm,
  onToggleSource,
}: {
  activeDecisionTitle: string | null;
  availableSources: ExternalSource[];
  selectedSourceIds: string[];
  draft: ExternalSourceImpactDraftResponse | null;
  confirmedEvidence: ConfirmedImpactEvidenceRecord[];
  isGenerating: boolean;
  isConfirmingAny: boolean;
  confirmingDraftKey: string | null;
  confirmedDraftKeys: string[];
  onGenerate: () => void;
  onConfirm: (item: ExternalSourceImpactDraftItem) => void;
  onToggleSource: (sourceId: string, checked: boolean) => void;
}) {
  const canGenerate = Boolean(activeDecisionTitle) && selectedSourceIds.length > 0;

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">路径影响草稿</p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            根据已关联当前人生节点的外部来源，生成候选路径证据草稿。这里只做
            deterministic 初步整理，只有你点击“确认写入正式证据”后，才会创建
            DecisionEvidence。
          </p>
          <div className="flex flex-wrap gap-2">
            <MetaBadge text={activeDecisionTitle ? activeDecisionTitle : "无 active 节点"} tone="emerald" />
            <MetaBadge text={`可用来源 ${availableSources.length}`} />
            <MetaBadge text={`本次选择 ${selectedSourceIds.length}`} />
            <MetaBadge text="候选草稿，确认后才入档" tone="sky" />
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          disabled={!canGenerate || isGenerating || isConfirmingAny}
          onClick={onGenerate}
        >
          {isGenerating ? "生成中..." : "生成路径影响草稿"}
        </Button>
      </div>

      {!canGenerate ? (
        <div className="mt-4 rounded-lg border border-dashed border-white/10 bg-background/45 px-4 py-4 text-sm leading-6 text-muted-foreground">
          请先确保存在 active decision，并至少勾选一条已关联当前节点的来源。
        </div>
      ) : null}

      {activeDecisionTitle ? (
        <div className="mt-4 rounded-lg border border-white/10 bg-background/45 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">本次用于生成草稿的已保存来源</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                这里只选择已保存且已关联当前人生节点的来源。候选草稿不会自动归档，必须逐条确认后才写入正式证据。
              </p>
            </div>
            <MetaBadge text={`已勾选 ${selectedSourceIds.length}`} tone="amber" />
          </div>

          <div className="mt-4 space-y-2">
            {availableSources.length === 0 ? (
              <EmptyState text="当前还没有可用于生成草稿的已关联来源。" />
            ) : (
              availableSources.map((source) => {
                const checked = selectedSourceIds.includes(source.id);

                return (
                  <label
                    key={source.id}
                    className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => onToggleSource(source.id, event.target.checked)}
                      disabled={isGenerating || isConfirmingAny}
                      aria-label={`${source.title} 用于本次影响草稿`}
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-background/50"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-foreground">{source.title}</span>
                      <span className="mt-1 block break-all leading-6 text-muted-foreground">
                        {source.sourceSite} · {source.url}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      {isGenerating && !draft ? (
        <div className="mt-4 rounded-lg border border-dashed border-white/10 bg-background/45 px-4 py-4 text-sm leading-6 text-muted-foreground">
          正在整理候选草稿。生成完成前不会写入任何正式证据。
        </div>
      ) : null}

      {draft ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-lg border border-dashed border-sky-500/20 bg-sky-500/10 px-4 py-4">
            <p className="text-sm font-medium text-foreground">候选草稿（未入档）</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              下面显示的是 AI 生成的候选内容、路径、证据类型、建议权重和来源链接。它们只是草稿，不代表最终判断，只有点击确认后才会写入正式证据。
            </p>
          </div>

          {draft.warnings.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-4">
              <p className="text-sm font-medium text-foreground">候选草稿 warning</p>
              {draft.warnings.map((warning) => (
                <p key={warning} className="text-sm leading-6 text-muted-foreground">
                  {warning}
                </p>
              ))}
            </div>
          ) : null}

          {draft.items.length === 0 ? (
            <EmptyState text="当前没有可确认的路径影响草稿。请补充候选路径或关联更多外部来源后再试。" />
          ) : (
            <div className="space-y-3">
              {draft.items.map((item) => {
                const draftKey = buildDraftKey(item);
                const isConfirmed = confirmedDraftKeys.includes(draftKey);
                const isConfirming = confirmingDraftKey === draftKey;

                return (
                  <article
                    key={draftKey}
                    className="rounded-lg border border-white/10 bg-background/55 px-4 py-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <MetaBadge
                            text={evidenceTypeLabelMap[item.evidenceType]}
                            tone={evidenceTypeToneMap[item.evidenceType]}
                          />
                          <MetaBadge text={`建议权重 ${item.suggestedWeight.toFixed(2)}`} />
                          <MetaBadge text={isConfirmed ? "已确认入证据" : "待用户确认"} tone={isConfirmed ? "emerald" : "amber"} />
                        </div>

                        <div>
                          <h3 className="text-base font-semibold tracking-tight text-foreground">
                            {item.pathTitle}
                          </h3>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground/80">
                            pathId: {item.pathId}
                          </p>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block text-sm leading-6 text-primary underline-offset-4 hover:underline"
                          >
                            {item.externalSourceTitle} · {item.sourceSite}
                          </a>
                        </div>

                        <p className="text-sm leading-6 text-muted-foreground">{item.rationale}</p>
                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
                            候选证据文案
                          </p>
                          <pre className="whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-muted-foreground">{item.suggestedContent}</pre>
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        className="w-full sm:w-auto"
                        disabled={isConfirmed || isConfirming || isConfirmingAny}
                        onClick={() => onConfirm(item)}
                      >
                        {isConfirmed
                          ? "已确认"
                          : isConfirming
                            ? "写入中..."
                            : "确认写入正式证据"}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-4">
            <p className="text-sm font-medium text-foreground">正式证据回执（已入档）</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              只有确认后的条目才会出现在这里。返回的 sourceCitationId 代表这条正式证据已经保留来源追溯锚点，后续可以回到原始外链继续核对。
            </p>
          </div>

          {confirmedEvidence.length === 0 ? (
            <EmptyState text="当前还没有确认写入的正式证据。确认前不会入档。" />
          ) : (
            <div className="space-y-3">
              {confirmedEvidence.map((record) => (
                <article
                  key={record.evidenceId}
                  className="rounded-lg border border-emerald-500/20 bg-background/55 px-4 py-4"
                >
                  <div className="flex flex-wrap gap-2">
                    <MetaBadge text="正式决策证据" tone="emerald" />
                    <MetaBadge
                      text={evidenceTypeLabelMap[record.evidenceType]}
                      tone={evidenceTypeToneMap[record.evidenceType]}
                    />
                    <MetaBadge text={`权重 ${Number(record.weight ?? 0).toFixed(2)}`} />
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <InfoBlock label="路径" value={record.pathTitle} />
                    <InfoBlock
                      label="sourceCitationId"
                      value={record.sourceCitationId?.trim() || "未返回"}
                    />
                  </div>

                  <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
                      正式证据内容
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {record.content}
                    </p>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-background/45 px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
                        来源追溯
                      </p>
                      <a
                        href={record.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block break-all text-sm leading-6 text-primary underline-offset-4 hover:underline"
                      >
                        {record.externalSourceTitle} · {record.sourceSite}
                      </a>
                    </div>
                    <InfoBlock
                      label="入档时间"
                      value={formatDateTime(record.createdAt) ?? "未记录"}
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}
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

function MetaBadge({
  text,
  tone = "default",
}: {
  text: string;
  tone?: "default" | "emerald" | "sky" | "amber" | "rose";
}) {
  const classNameMap = {
    default: "border-white/10 bg-background/50 text-muted-foreground",
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-foreground",
    sky: "border-sky-500/20 bg-sky-500/10 text-foreground",
    amber: "border-amber-500/20 bg-amber-500/10 text-foreground",
    rose: "border-rose-500/20 bg-rose-500/10 text-foreground",
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
    <div
      role={state.type === "success" ? "status" : "alert"}
      className={`rounded-lg border px-4 py-3 text-sm text-foreground ${toneClassName}`}
    >
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

function normalizeOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const evidenceTypeLabelMap = {
  support: "候选支持",
  against: "候选反对",
  neutral: "候选中性",
} as const;

const evidenceTypeToneMap = {
  support: "emerald",
  against: "rose",
  neutral: "sky",
} as const;

function buildDraftKey(item: ExternalSourceImpactDraftItem) {
  return `${item.externalSourceId}:${item.pathId}:${item.evidenceType}`;
}

function normalizePublishedDate(value: string) {
  const trimmed = value.trim();
  return trimmed ? `${trimmed}T00:00:00.000Z` : null;
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
