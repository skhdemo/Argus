"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { Claim, ClaimType, Edge, EdgeType } from "@/lib/types/debate";

type DebateGraphProps = {
  claims: Claim[];
  edges: Edge[];
  selectedClaimId: string | null;
  onSelectClaim: (id: string) => void;
};

type Lane = "A" | "B" | "neutral";

type Point = { x: number; y: number };

const CLAIM_TYPE_COLOR_VAR: Record<ClaimType, string> = {
  supported: "var(--claim-supported)",
  assumption: "var(--claim-assumption)",
  needs_evidence: "var(--claim-needs-evidence)",
  counterargument: "var(--claim-counterargument)",
};

const CLAIM_TYPE_LABEL: Record<ClaimType, string> = {
  supported: "Supported",
  assumption: "Assumption",
  needs_evidence: "Needs evidence",
  counterargument: "Counterargument",
};

// supports=solid, contradicts=dashed, responds_to=dotted — plan §4.4.
const EDGE_DASH: Record<EdgeType, string | undefined> = {
  supports: undefined,
  contradicts: "6 4",
  responds_to: "1 4",
};

function laneOf(claim: Claim): Lane {
  if (claim.speaker === "A") return "A";
  if (claim.speaker === "B") return "B";
  return "neutral";
}

function anchorPoint(rect: DOMRect, lane: Lane): Point {
  const y = rect.top + rect.height / 2;
  if (lane === "A") return { x: rect.left + rect.width, y }; // exit right edge, toward center
  if (lane === "B") return { x: rect.left, y }; // exit left edge, toward center
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height }; // neutral: bottom
}

function bezierPath(p1: Point, p2: Point): string {
  const midX = (p1.x + p2.x) / 2;
  return `M ${p1.x} ${p1.y} C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y}`;
}

function NodeCard({
  claim,
  lane,
  isSelected,
  onSelectClaim,
  registerRef,
}: {
  claim: Claim;
  lane: Lane;
  isSelected: boolean;
  onSelectClaim: (id: string) => void;
  registerRef: (el: HTMLDivElement | null) => void;
}) {
  const popoverSide =
    lane === "A" ? "left-full ml-2" : lane === "B" ? "right-full mr-2" : "top-full mt-2";

  return (
    <div
      ref={registerRef}
      onClick={() => onSelectClaim(claim.id)}
      className={`group relative h-20 w-full cursor-pointer rounded-md border-2 bg-surface p-2 transition-shadow ${
        isSelected ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : ""
      }`}
      style={{ borderColor: CLAIM_TYPE_COLOR_VAR[claim.type] }}
    >
      <p className="line-clamp-3 text-xs leading-snug">{claim.text}</p>

      {/* Hover popover — CSS-only via group-hover, no extra JS state. Always
          opens toward the viewport center so it can't clip off a fixed
          desktop viewport edge (A opens right, B opens left). */}
      <div
        className={`invisible absolute top-0 z-30 w-72 -translate-y-1/4 scale-95 rounded-md border border-border bg-surface p-3 opacity-0 shadow-lg transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 ${popoverSide}`}
      >
        <p className="text-sm leading-relaxed">{claim.text}</p>
        <p className="mt-2 text-xs text-muted">
          Speaker {claim.speaker} · {CLAIM_TYPE_LABEL[claim.type]}
        </p>
        {claim.sourceExcerpt && (
          <p className="mt-1 text-xs italic text-muted">&ldquo;{claim.sourceExcerpt}&rdquo;</p>
        )}
      </div>
    </div>
  );
}

function Lane({
  lane,
  label,
  claims,
  selectedClaimId,
  onSelectClaim,
  registerNodeRef,
}: {
  lane: "A" | "B";
  label: string;
  claims: Claim[];
  selectedClaimId: string | null;
  onSelectClaim: (id: string) => void;
  registerNodeRef: (id: string) => (el: HTMLDivElement | null) => void;
}) {
  const speakerVar = lane === "A" ? "var(--speaker-a)" : "var(--speaker-b)";

  return (
    <div className="relative flex flex-1 flex-col items-center px-4 pt-4">
      {claims.length > 0 && (
        <div
          aria-hidden
          className="absolute bottom-4 left-1/2 top-12 w-px -translate-x-1/2"
          style={{ background: speakerVar, opacity: 0.35 }}
        />
      )}
      <div
        className="relative z-10 font-mono text-sm font-semibold"
        style={{ color: speakerVar }}
      >
        {label}
      </div>
      <div className="relative z-10 mt-3 flex w-full max-w-[220px] flex-col gap-3">
        {claims.map((claim) => (
          <NodeCard
            key={claim.id}
            claim={claim}
            lane={lane}
            isSelected={selectedClaimId === claim.id}
            onSelectClaim={onSelectClaim}
            registerRef={registerNodeRef(claim.id)}
          />
        ))}
      </div>
    </div>
  );
}

export function DebateGraph({
  claims,
  edges,
  selectedClaimId,
  onSelectClaim,
}: DebateGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const [nodeRects, setNodeRects] = useState<Map<string, DOMRect>>(new Map());

  const registerNodeRef = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      if (el) nodeRefs.current.set(id, el);
      else nodeRefs.current.delete(id);
    },
    [],
  );

  const recomputeRects = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const next = new Map<string, DOMRect>();
    for (const [id, el] of nodeRefs.current) {
      const r = el.getBoundingClientRect();
      next.set(
        id,
        new DOMRect(r.left - containerRect.left, r.top - containerRect.top, r.width, r.height),
      );
    }
    setNodeRects(next);
  }, []);

  useLayoutEffect(() => {
    recomputeRects();
  }, [claims, edges, recomputeRects]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => recomputeRects());
    ro.observe(container);
    return () => ro.disconnect();
  }, [recomputeRects]);

  const claimsById = useMemo(() => new Map(claims.map((c) => [c.id, c])), [claims]);

  const { claimsA, claimsB, claimsNeutral } = useMemo(() => {
    const sorted = [...claims].sort((a, b) => a.createdAt - b.createdAt);
    return {
      claimsA: sorted.filter((c) => laneOf(c) === "A"),
      claimsB: sorted.filter((c) => laneOf(c) === "B"),
      claimsNeutral: sorted.filter((c) => laneOf(c) === "neutral"),
    };
  }, [claims]);

  const isEmpty = claims.length === 0;

  return (
    <div ref={containerRef} className="relative flex h-full">
      {isEmpty && (
        <p className="absolute inset-0 z-20 flex items-center justify-center font-mono text-sm text-muted">
          Waiting for first claim…
        </p>
      )}

      <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full" aria-hidden>
        {edges.map((edge) => {
          const fromClaim = claimsById.get(edge.from);
          const toClaim = claimsById.get(edge.to);
          const fromRect = nodeRects.get(edge.from);
          const toRect = nodeRects.get(edge.to);
          if (!fromClaim || !toClaim || !fromRect || !toRect) return null;

          const p1 = anchorPoint(fromRect, laneOf(fromClaim));
          const p2 = anchorPoint(toRect, laneOf(toClaim));

          return (
            <path
              key={edge.id}
              d={bezierPath(p1, p2)}
              stroke="var(--muted)"
              strokeOpacity={0.6}
              strokeWidth={1.5}
              strokeDasharray={EDGE_DASH[edge.type]}
              fill="none"
            />
          );
        })}
      </svg>

      <Lane
        lane="A"
        label="A"
        claims={claimsA}
        selectedClaimId={selectedClaimId}
        onSelectClaim={onSelectClaim}
        registerNodeRef={registerNodeRef}
      />

      {claimsNeutral.length > 0 && (
        <div className="relative flex w-24 flex-col items-center px-2 pt-4">
          <div className="relative z-10 font-mono text-xs text-muted">?</div>
          <div className="relative z-10 mt-3 flex w-full flex-col gap-3">
            {claimsNeutral.map((claim) => (
              <NodeCard
                key={claim.id}
                claim={claim}
                lane="neutral"
                isSelected={selectedClaimId === claim.id}
                onSelectClaim={onSelectClaim}
                registerRef={registerNodeRef(claim.id)}
              />
            ))}
          </div>
        </div>
      )}

      <Lane
        lane="B"
        label="B"
        claims={claimsB}
        selectedClaimId={selectedClaimId}
        onSelectClaim={onSelectClaim}
        registerNodeRef={registerNodeRef}
      />
    </div>
  );
}
