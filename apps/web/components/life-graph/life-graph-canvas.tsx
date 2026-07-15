"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D, {
  type ForceGraphMethods,
  type LinkObject,
  type NodeObject,
} from "react-force-graph-3d";
import type { LifeGraphEdge, LifeGraphNode } from "@digital-self/shared";

type PositionedNode = LifeGraphNode & {
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
};

type GraphLink = LifeGraphEdge & {
  source: string | PositionedNode;
  target: string | PositionedNode;
};

type LifeGraphCanvasProps = {
  nodes: LifeGraphNode[];
  edges: LifeGraphEdge[];
  selectedId?: string;
  onSelect: (nodeId?: string) => void;
};

const nodeColors: Record<LifeGraphNode["nodeType"], string> = {
  event: "#cbd5e1",
  memory: "#34d399",
  project: "#60a5fa",
  ability: "#a78bfa",
  decision: "#fb7185",
  person: "#fcd34d",
  goal: "#67e8f9",
  plan: "#38bdf8",
  milestone: "#fb923c",
  action: "#a3e635",
};

export function LifeGraphCanvas({ nodes, edges, selectedId, onSelect }: LifeGraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods | undefined>(undefined);
  const [size, setSize] = useState({ width: 900, height: 620 });
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({
        width: Math.max(Math.round(entry.contentRect.width), 320),
        height: Math.max(Math.round(entry.contentRect.height), 520),
      });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const neighborIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const result = new Set<string>([selectedId]);
    for (const edge of edges) {
      if (edge.source === selectedId) result.add(edge.target);
      if (edge.target === selectedId) result.add(edge.source);
    }
    return result;
  }, [edges, selectedId]);

  const graphData = useMemo(() => {
    const datedNodes = nodes.filter((node) => node.occurredAt);
    const times = datedNodes.map((node) => new Date(node.occurredAt as string).getTime());
    const minimum = Math.min(...times);
    const maximum = Math.max(...times);
    const spread = maximum - minimum || 1;

    return {
      nodes: nodes.map<PositionedNode>((node) => ({
        ...node,
        fx: node.occurredAt
          ? -220 + ((new Date(node.occurredAt).getTime() - minimum) / spread) * 440
          : undefined,
      })),
      links: edges.map<GraphLink>((edge) => ({ ...edge })),
    };
  }, [edges, nodes]);

  useEffect(() => {
    if (!selectedId) return;
    const node = graphData.nodes.find((item) => item.id === selectedId);
    if (!node || node.x === undefined || node.y === undefined || node.z === undefined) return;
    const distance = Math.hypot(node.x, node.y, node.z);
    const ratio = distance > 0 ? 1 + 95 / distance : 1;
    graphRef.current?.cameraPosition(
      distance > 0
        ? { x: node.x * ratio, y: node.y * ratio, z: node.z * ratio }
        : { x: 0, y: 0, z: 95 },
      { x: node.x, y: node.y, z: node.z },
      reducedMotion ? 0 : 650,
    );
  }, [graphData.nodes, reducedMotion, selectedId]);

  function nodeColor(nodeObject: NodeObject): string {
    const node = nodeObject as PositionedNode;
    if (node.id === selectedId) return "#f8fafc";
    if (selectedId && !neighborIds.has(node.id)) return "#334155";
    if (node.reviewState === "candidate") return "#f59e0b";
    return nodeColors[node.nodeType];
  }

  function linkColor(linkObject: LinkObject): string {
    const link = linkObject as GraphLink;
    const sourceId = endpointId(link.source);
    const targetId = endpointId(link.target);
    if (selectedId && (sourceId === selectedId || targetId === selectedId)) return "#94a3b8";
    if (selectedId) return "#1e293b";
    return link.reviewState === "candidate" ? "#d97706" : "#64748b";
  }

  return (
    <div
      ref={containerRef}
      className="h-[560px] min-h-[520px] w-full overflow-hidden bg-[#071018] lg:h-[680px]"
      aria-label="可旋转和缩放的 3D 人生关系图"
    >
      <ForceGraph3D
        ref={graphRef}
        width={size.width}
        height={size.height}
        graphData={graphData}
        backgroundColor="#071018"
        showNavInfo={false}
        nodeId="id"
        nodeVal={(node) => Math.max(((node as PositionedNode).importance ?? 1) * 6, 4)}
        nodeColor={nodeColor}
        nodeOpacity={0.94}
        nodeResolution={12}
        nodeLabel={(node) => escapeHtml((node as PositionedNode).title)}
        linkLabel={(link) => escapeHtml((link as GraphLink).label)}
        linkColor={linkColor}
        linkWidth={(link) => {
          const graphLink = link as GraphLink;
          return selectedId &&
            (endpointId(graphLink.source) === selectedId || endpointId(graphLink.target) === selectedId)
            ? 2.2
            : 1.2;
        }}
        linkOpacity={0.86}
        linkDirectionalArrowLength={2.6}
        linkDirectionalArrowRelPos={0.83}
        linkDirectionalArrowColor={linkColor}
        warmupTicks={70}
        cooldownTicks={160}
        d3VelocityDecay={0.32}
        onNodeClick={(node) => onSelect((node as PositionedNode).id)}
        onBackgroundClick={() => onSelect(undefined)}
        onEngineStop={() => graphRef.current?.zoomToFit(reducedMotion ? 0 : 500, 55)}
      />
    </div>
  );
}

function endpointId(endpoint: string | PositionedNode | number | NodeObject | undefined): string {
  if (typeof endpoint === "string" || typeof endpoint === "number") return String(endpoint);
  return endpoint?.id ? String(endpoint.id) : "";
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ] ?? character,
  );
}
