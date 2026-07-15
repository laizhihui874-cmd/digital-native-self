"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  LifeGraphEdge,
  LifeGraphNode,
  LifeGraphNodeType,
  LifeGraphSubgraphResponse,
  CreateGraphRelationRequest,
} from "@digital-self/shared";

import { Button } from "@/components/ui/button";
import { AskAssistantLink } from "@/components/assistant/ask-assistant-link";
import { apiRequest } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const LifeGraphCanvas = dynamic(
  () => import("./life-graph-canvas").then((module) => module.LifeGraphCanvas),
  {
    ssr: false,
    loading: () => <GraphMessage title="正在打开 3D 场景" detail="首次加载会多花一点时间。" />,
  },
);

const nodeTypes: Array<{ value: LifeGraphNodeType; label: string; color: string }> = [
  { value: "event", label: "事件", color: "bg-slate-300" },
  { value: "memory", label: "记忆", color: "bg-emerald-400" },
  { value: "project", label: "项目", color: "bg-blue-400" },
  { value: "ability", label: "能力", color: "bg-violet-400" },
  { value: "decision", label: "决策", color: "bg-rose-400" },
  { value: "person", label: "人物", color: "bg-amber-300" },
  { value: "goal", label: "目标", color: "bg-cyan-300" },
  { value: "plan", label: "计划", color: "bg-sky-400" },
  { value: "milestone", label: "里程碑", color: "bg-orange-400" },
  { value: "action", label: "行动", color: "bg-lime-400" },
];

export function LifeGraphWorkspace() {
  const [data, setData] = useState<LifeGraphSubgraphResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const [centerId, setCenterId] = useState<string>();
  const [depth, setDepth] = useState<1 | 2 | 3>(2);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [asOf, setAsOf] = useState("");
  const [search, setSearch] = useState("");
  const [showCandidates, setShowCandidates] = useState(true);
  const [enabledTypes, setEnabledTypes] = useState<Set<LifeGraphNodeType>>(
    () => new Set(nodeTypes.map((item) => item.value)),
  );
  const [hasWebGl, setHasWebGl] = useState(true);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    const params = new URLSearchParams({ depth: String(depth), limit: "260" });
    if (centerId) params.set("centerId", centerId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (asOf) params.set("asOf", asOf);
    if (enabledTypes.size > 0 && enabledTypes.size < nodeTypes.length) {
      params.set("nodeTypes", Array.from(enabledTypes).join(","));
    }

    try {
      const response = await apiRequest<LifeGraphSubgraphResponse>(
        `/api/life-graph/subgraph?${params.toString()}`,
      );
      setData(response.data);
      setSelectedId((current) =>
        current && response.data.nodes.some((node) => node.id === current) ? current : undefined,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "人生星图暂时无法读取。" );
    } finally {
      setLoading(false);
    }
  }, [asOf, centerId, depth, enabledTypes, from, to]);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    setHasWebGl(Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl")));
  }, []);

  const visibleData = useMemo(() => {
    if (!data || showCandidates) return data;
    const nodes = data.nodes.filter((node) => node.reviewState !== "candidate");
    const ids = new Set(nodes.map((node) => node.id));
    return {
      ...data,
      nodes,
      edges: data.edges.filter((edge) =>
        edge.reviewState !== "candidate" && ids.has(edge.source) && ids.has(edge.target),
      ),
    };
  }, [data, showCandidates]);

  const selectedNode = visibleData?.nodes.find((node) => node.id === selectedId);
  const selectedEdges = selectedId
    ? visibleData?.edges.filter((edge) => edge.source === selectedId || edge.target === selectedId) ?? []
    : [];
  const searchResults = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("zh-CN");
    if (!keyword || !visibleData) return [];
    return visibleData.nodes
      .filter((node) => `${node.title} ${node.summary ?? ""}`.toLocaleLowerCase("zh-CN").includes(keyword))
      .slice(0, 8);
  }, [search, visibleData]);

  function toggleNodeType(type: LifeGraphNodeType) {
    setEnabledTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next.size > 0 ? next : current;
    });
  }

  function selectNode(nodeId?: string) {
    setSelectedId(nodeId);
    if (nodeId) setSearch("");
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-3">
        <div className="grid gap-3 border border-border/70 bg-card/70 p-3 shadow-panel md:grid-cols-[minmax(180px,1fr)_auto] md:items-start">
          <div className="relative">
            <label htmlFor="life-graph-search" className="sr-only">搜索人生星图节点</label>
            <input
              id="life-graph-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索事件、记忆、人物、目标、计划或行动"
              className="h-10 w-full border border-input bg-background/80 px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            {search.trim() && (
              <div className="absolute left-0 right-0 top-11 z-30 max-h-72 overflow-y-auto border border-border bg-card p-1 shadow-lg">
                {searchResults.length > 0 ? searchResults.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => selectNode(node.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <NodeDot type={node.nodeType} candidate={node.reviewState === "candidate"} />
                    <span className="min-w-0 flex-1 truncate">{node.title}</span>
                    <span className="text-xs text-muted-foreground">{typeLabel(node.nodeType)}</span>
                  </button>
                )) : (
                  <p className="px-3 py-4 text-sm text-muted-foreground">当前图中没有匹配内容。</p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {nodeTypes.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={enabledTypes.has(item.value)}
                onClick={() => toggleNodeType(item.value)}
                className={cn(
                  "inline-flex h-10 items-center gap-2 border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  enabledTypes.has(item.value)
                    ? "border-border bg-background text-foreground"
                    : "border-transparent bg-muted/60 text-muted-foreground",
                )}
              >
                <span className={cn("h-2 w-2", item.color)} />
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3 md:col-span-2">
            <DateField label="开始日期" value={from} onChange={setFrom} />
            <DateField label="结束日期" value={to} onChange={setTo} />
            <DateField label="回看到日期" value={asOf} onChange={setAsOf} />
            <label className="grid gap-1 text-xs text-muted-foreground">
              局部深度
              <select
                value={depth}
                onChange={(event) => setDepth(Number(event.target.value) as 1 | 2 | 3)}
                className="h-10 border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value={1}>1 层</option>
                <option value={2}>2 层</option>
                <option value={3}>3 层</option>
              </select>
            </label>
            <label className="flex h-10 items-center gap-2 border border-input bg-background px-3 text-xs font-medium text-foreground">
              <input
                type="checkbox"
                checked={showCandidates}
                onChange={(event) => setShowCandidates(event.target.checked)}
                className="h-4 w-4 accent-amber-500"
              />
              显示待确认内容
            </label>
            {centerId && (
              <Button type="button" variant="secondary" onClick={() => setCenterId(undefined)}>
                返回全图
              </Button>
            )}
          </div>
        </div>

        <div className="relative overflow-hidden border border-slate-800 bg-[#071018] shadow-panel">
          <div className="absolute left-3 top-3 z-20 flex flex-wrap gap-x-4 gap-y-2 bg-slate-950/75 px-3 py-2 text-[11px] text-slate-300 backdrop-blur-sm">
            {nodeTypes.map((item) => (
              <span key={item.value} className="inline-flex items-center gap-1.5">
                <span className={cn("h-2 w-2", item.color)} />{item.label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 bg-amber-500" />待确认</span>
          </div>

          {loading ? (
            <GraphMessage title="正在整理人生星图" detail="读取事件、记忆和它们已有的联系。" />
          ) : error ? (
            <GraphMessage title="没有读到星图数据" detail={error} action={<Button onClick={() => void loadGraph()}>重新读取</Button>} />
          ) : !visibleData || visibleData.nodes.length === 0 ? (
            <GraphMessage title="当前条件下还没有节点" detail="可以放宽日期或类型筛选，也可以先记录一条生活事件。" />
          ) : hasWebGl ? (
            <LifeGraphCanvas
              nodes={visibleData.nodes}
              edges={visibleData.edges}
              selectedId={selectedId}
              onSelect={selectNode}
            />
          ) : (
            <GraphFallbackList nodes={visibleData.nodes} selectedId={selectedId} onSelect={selectNode} />
          )}

          {visibleData && !loading && !error && (
            <div className="absolute bottom-3 left-3 z-20 bg-slate-950/75 px-3 py-2 text-[11px] text-slate-300 backdrop-blur-sm">
              {visibleData.nodes.length} 个节点 · {visibleData.edges.length} 条联系
              {visibleData.summary.truncated ? " · 已按上限截取" : ""}
            </div>
          )}
        </div>

        <p className="text-xs leading-5 text-muted-foreground">
          横向位置按时间排布；拖动可旋转，滚轮或触控板可缩放，点击空白处取消选择。
        </p>
      </div>

      <NodeDetail
        node={selectedNode}
        edges={selectedEdges}
        allNodes={visibleData?.nodes ?? []}
        centerId={centerId}
        onFocus={(id) => setCenterId(id)}
        onSelect={selectNode}
        onCreateRelation={async (input) => {
          await apiRequest("/api/graph-relations", { method: "POST", body: JSON.stringify(input) });
          await loadGraph();
        }}
      />
    </section>
  );
}

function NodeDetail({
  node,
  edges,
  allNodes,
  centerId,
  onFocus,
  onSelect,
  onCreateRelation,
}: {
  node?: LifeGraphNode;
  edges: LifeGraphEdge[];
  allNodes: LifeGraphNode[];
  centerId?: string;
  onFocus: (id: string) => void;
  onSelect: (id: string) => void;
  onCreateRelation: (input: CreateGraphRelationRequest) => Promise<void>;
}) {
  const [targetId, setTargetId] = useState("");
  const [relationLabel, setRelationLabel] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [relationMessage, setRelationMessage] = useState<string>();
  const [relationBusy, setRelationBusy] = useState(false);

  if (!node) {
    return (
      <aside className="border border-border/70 bg-card/70 p-5 shadow-panel xl:sticky xl:top-24 xl:h-fit">
        <p className="text-xs font-medium tracking-[0.14em] text-primary">节点详情</p>
        <h3 className="mt-3 text-lg font-semibold">选择一个节点</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          这里会显示内容、日期、来源和直接相连的记录。也可以把它设为中心查看局部图。
        </p>
      </aside>
    );
  }

  const targets = allNodes.filter((item) => item.id !== node.id);

  async function submitRelation(event: React.FormEvent) {
    event.preventDefault();
    const target = allNodes.find((item) => item.id === targetId);
    if (!target || !node) return;
    setRelationBusy(true);
    setRelationMessage(undefined);
    try {
      await onCreateRelation({
        sourceType: node.nodeType,
        sourceId: node.entityId,
        targetType: target.nodeType,
        targetId: target.entityId,
        relationType: "manual",
        label: relationLabel.trim(),
        status: "confirmed",
        validFrom: validFrom ? `${validFrom}T00:00:00.000Z` : undefined,
        validTo: validTo ? `${validTo}T00:00:00.000Z` : undefined,
      });
      setTargetId("");
      setRelationLabel("");
      setValidFrom("");
      setValidTo("");
      setRelationMessage("关系已加入星图。");
    } catch (cause) {
      setRelationMessage(cause instanceof Error ? cause.message : "保存关系失败。");
    } finally {
      setRelationBusy(false);
    }
  }

  return (
    <aside className="border border-border/70 bg-card/75 p-5 shadow-panel xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <NodeDot type={node.nodeType} candidate={node.reviewState === "candidate"} />
          {typeLabel(node.nodeType)}
        </span>
        <span className={cn(
          "border px-2 py-1 text-[11px]",
          node.reviewState === "candidate"
            ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
            : "border-border bg-muted/60 text-muted-foreground",
        )}>
          {statusLabel(node)}
        </span>
      </div>
      <h3 className="mt-4 text-lg font-semibold leading-7 text-foreground">{node.title}</h3>
      {node.summary && node.summary !== node.title && (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{node.summary}</p>
      )}
      <dl className="mt-5 grid gap-3 border-y border-border/70 py-4 text-xs">
        <DetailRow label="时间" value={formatDate(node.occurredAt ?? node.createdAt)} />
        <DetailRow label="当前状态" value={node.status} />
        <DetailRow label="直接联系" value={`${edges.length} 条`} />
      </dl>

      {node.source && (
        <div className="mt-5">
          <p className="text-xs font-medium text-foreground">来源</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {node.source.title ?? `${node.source.sourceType} · ${node.source.sourceId}`}
          </p>
          {node.source.excerpt && (
            <blockquote className="mt-2 border-l-2 border-primary/40 pl-3 text-xs leading-5 text-muted-foreground">
              {node.source.excerpt}
            </blockquote>
          )}
        </div>
      )}

      <div className="mt-5 flex gap-2">
        <Button
          type="button"
          className="flex-1"
          disabled={centerId === node.id}
          onClick={() => onFocus(node.id)}
        >
          {centerId === node.id ? "正在查看局部图" : "查看局部图"}
        </Button>
        {node.reviewState !== "candidate" && <AskAssistantLink entityType={node.nodeType} entityId={node.entityId} label="询问 AI" />}
      </div>

      <div className="mt-6">
        <p className="text-xs font-medium text-foreground">相连记录</p>
        {edges.length === 0 ? (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">当前筛选范围内没有直接联系。</p>
        ) : (
          <div className="mt-2 divide-y divide-border/60 border-y border-border/60">
            {edges.slice(0, 12).map((edge) => {
              const otherId = edge.source === node.id ? edge.target : edge.source;
              const other = allNodes.find((item) => item.id === otherId);
              if (!other) return null;
              return (
                <button
                  key={edge.id}
                  type="button"
                  onClick={() => onSelect(other.id)}
                  className="block w-full py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="block text-[11px] text-muted-foreground">{edge.label}</span>
                  <span className="mt-1 block text-sm font-medium text-foreground">{other.title}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <form className="mt-6 space-y-3 border-t border-border/70 pt-5" onSubmit={submitRelation}>
        <div>
          <p className="text-xs font-medium text-foreground">建立人工关系</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">只连接你明确选择的两个节点，可填写关系生效和结束日期。</p>
        </div>
        <label className="grid gap-1 text-xs text-muted-foreground">
          连接到
          <select required value={targetId} onChange={(event) => setTargetId(event.target.value)} className="h-10 border border-input bg-background px-3 text-sm text-foreground">
            <option value="">选择节点</option>
            {targets.slice(0, 240).map((target) => <option key={target.id} value={target.id}>{typeLabel(target.nodeType)} · {target.title}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          关系名称
          <input required value={relationLabel} onChange={(event) => setRelationLabel(event.target.value)} placeholder="例如：促成、参与、影响" className="h-10 border border-input bg-background px-3 text-sm text-foreground" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <DateField label="生效日期" value={validFrom} onChange={setValidFrom} />
          <DateField label="结束日期" value={validTo} onChange={setValidTo} />
        </div>
        <Button type="submit" size="sm" disabled={relationBusy || !targetId || !relationLabel.trim()}>{relationBusy ? "保存中…" : "加入关系"}</Button>
        {relationMessage && <p className="text-xs leading-5 text-muted-foreground">{relationMessage}</p>}
      </form>
    </aside>
  );
}

function GraphFallbackList({ nodes, selectedId, onSelect }: {
  nodes: LifeGraphNode[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="min-h-[560px] overflow-y-auto px-4 pb-16 pt-20 text-slate-100">
      <p className="mb-4 text-sm text-slate-300">当前设备没有提供 WebGL，先用时间列表浏览。</p>
      <div className="divide-y divide-slate-800 border-y border-slate-800">
        {nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            onClick={() => onSelect(node.id)}
            className={cn("flex w-full items-center gap-3 py-3 text-left", selectedId === node.id && "text-emerald-300")}
          >
            <NodeDot type={node.nodeType} candidate={node.reviewState === "candidate"} />
            <span className="min-w-0 flex-1 truncate text-sm">{node.title}</span>
            <time className="text-xs text-slate-400">{formatDate(node.occurredAt ?? node.createdAt)}</time>
          </button>
        ))}
      </div>
    </div>
  );
}

function GraphMessage({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-[560px] items-center justify-center bg-[#071018] px-6 text-center text-slate-100 lg:min-h-[680px]">
      <div className="max-w-md">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
      />
    </label>
  );
}

function NodeDot({ type, candidate }: { type: LifeGraphNodeType; candidate: boolean }) {
  const color = candidate ? "bg-amber-500" : nodeTypes.find((item) => item.value === type)?.color;
  return <span className={cn("h-2.5 w-2.5 shrink-0", color)} aria-hidden="true" />;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}

function typeLabel(type: LifeGraphNodeType): string {
  return nodeTypes.find((item) => item.value === type)?.label ?? type;
}

function statusLabel(node: LifeGraphNode): string {
  if (node.reviewState === "candidate") return "待确认";
  if (node.reviewState === "confirmed") return "已确认";
  return node.status;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}
