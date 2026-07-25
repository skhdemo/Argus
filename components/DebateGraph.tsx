"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Claim, ClaimType, Edge, EdgeType } from "@/lib/types/debate";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

type DebateGraphProps = {
  claims: Claim[];
  edges: Edge[];
  selectedClaimId: string | null;
  onSelectClaim: (id: string) => void;
};

type GraphNode = {
  id: string;
  name: string;
  claimType: ClaimType;
  speaker: Claim["speaker"];
  confidence?: number;
  unsupported?: boolean;
  hasFallacy?: boolean;
  val: number;
  x?: number;
  y?: number;
};

type GraphLink = {
  source: string;
  target: string;
  edgeType: EdgeType;
};

const TYPE_COLOR: Record<ClaimType, string> = {
  supported: "#15803d",
  assumption: "#a16207",
  needs_evidence: "#b91c1c",
  counterargument: "#1d4ed8",
};

const SPEAKER_RING: Record<"A" | "B", string> = {
  A: "#1d4ed8",
  B: "#c2410c",
};

function edgeStyle(type: EdgeType): {
  color: string;
  dash: number[];
  width: number;
} {
  switch (type) {
    case "supports":
      return { color: "rgba(15, 118, 110, 0.75)", dash: [], width: 1.6 };
    case "contradicts":
      return { color: "rgba(185, 28, 28, 0.7)", dash: [6, 4], width: 1.5 };
    case "responds_to":
      return { color: "rgba(90, 101, 114, 0.7)", dash: [2, 4], width: 1.3 };
  }
}

export function DebateGraph({
  claims,
  edges,
  selectedClaimId,
  onSelectClaim,
}: DebateGraphProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: 420 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const selectedRef = useRef(selectedClaimId);
  selectedRef.current = selectedClaimId;

  // Preserve simulation positions across claim updates / selection changes.
  const posRef = useRef(new Map<string, { x: number; y: number }>());

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.max(320, width), h: Math.max(280, height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    const nodes: GraphNode[] = claims.map((c) => {
      const prev = posRef.current.get(c.id);
      return {
        id: c.id,
        name: c.text,
        claimType: c.type,
        speaker: c.speaker,
        confidence: c.speakerConfidence,
        unsupported: c.unsupported,
        hasFallacy: Boolean(c.fallacies?.length),
        val: 2.2,
        ...(prev ? { x: prev.x, y: prev.y } : {}),
      };
    });
    const links: GraphLink[] = edges.map((e) => ({
      source: e.from,
      target: e.to,
      edgeType: e.type,
    }));
    return { nodes, links };
  }, [claims, edges]);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force("charge")?.strength(-160);
    fg.d3Force("link")?.distance(78);
  }, [data.nodes.length]);

  // Selection change: repaint only, do not rebuild graphData.
  useEffect(() => {
    fgRef.current?.refresh?.();
  }, [selectedClaimId]);

  if (claims.length === 0) {
    return (
      <div
        ref={wrapRef}
        className="flex h-full min-h-[320px] items-center justify-center"
      >
        <div className="max-w-sm text-center">
          <p className="font-display text-xl font-semibold tracking-tight text-foreground">
            Waiting for the first claim
          </p>
          <p className="mt-2 text-sm text-muted">
            Start listening. As the debate moves, nodes will bloom into this
            map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative h-full min-h-[320px] w-full">
      <ForceGraph2D
        ref={fgRef}
        width={size.w}
        height={size.h}
        graphData={data}
        backgroundColor="rgba(0,0,0,0)"
        nodeRelSize={6}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        cooldownTicks={80}
        onEngineTick={() => {
          for (const n of data.nodes) {
            if (typeof n.x === "number" && typeof n.y === "number") {
              posRef.current.set(n.id, { x: n.x, y: n.y });
            }
          }
        }}
        onNodeClick={(node) => {
          if (node.id) onSelectClaim(String(node.id));
        }}
        linkColor={(link) => edgeStyle((link as GraphLink).edgeType).color}
        linkWidth={(link) => edgeStyle((link as GraphLink).edgeType).width}
        linkLineDash={(link) => edgeStyle((link as GraphLink).edgeType).dash}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const n = node as GraphNode;
          const label =
            n.name.length > 42 ? `${n.name.slice(0, 42)}…` : n.name;
          const fontSize = 11 / globalScale;
          const selected = n.id === selectedRef.current;
          const r = (selected ? 3.2 : 2.2) * 3.2;
          const x = n.x ?? 0;
          const y = n.y ?? 0;

          ctx.beginPath();
          ctx.arc(x, y, r + (selected ? 3 : 0), 0, Math.PI * 2);
          ctx.fillStyle = selected
            ? "rgba(15, 118, 110, 0.18)"
            : "rgba(255,255,255,0.65)";
          ctx.fill();

          if (n.speaker === "A" || n.speaker === "B") {
            ctx.beginPath();
            ctx.arc(x, y, r + 1.8, 0, Math.PI * 2);
            ctx.strokeStyle = SPEAKER_RING[n.speaker];
            ctx.lineWidth = 1.4 / globalScale;
            ctx.stroke();
          }

          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = TYPE_COLOR[n.claimType];
          ctx.fill();

          if (n.unsupported || n.hasFallacy) {
            ctx.beginPath();
            ctx.arc(x, y, r + 3.2, 0, Math.PI * 2);
            ctx.strokeStyle = n.unsupported
              ? "rgba(185, 28, 28, 0.75)"
              : "rgba(180, 83, 9, 0.8)";
            ctx.lineWidth = 1.3 / globalScale;
            ctx.stroke();
          }

          ctx.font = `500 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = "rgba(12, 17, 24, 0.88)";
          ctx.fillText(label, x, y + r + 4 / globalScale);
        }}
      />
    </div>
  );
}
