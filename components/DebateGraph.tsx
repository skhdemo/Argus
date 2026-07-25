"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ClaimHoverCard } from "@/components/debate/ClaimHoverCard";
import {
  CLAIM_NATURE_LABEL,
  CLAIM_STATUS_COLOR,
  CLAIM_STATUS_LABEL,
} from "@/components/debate/statusPresentation";
import type { EvidenceVerificationQueueState } from "@/hooks/useEvidenceVerification";
import { deriveClaimDisplayStatus } from "@/lib/debate/status";
import type {
  Claim,
  Evidence,
  Relation,
  RelationType,
} from "@/lib/types/debate";

type DebateGraphProps = {
  claims: Claim[];
  evidence: Evidence[];
  relations: Relation[];
  queueState: EvidenceVerificationQueueState;
  onRetryEvidence: (evidenceId: string) => void;
  speakerAName: string;
  speakerBName: string;
  onRenameA: (name: string) => void;
  onRenameB: (name: string) => void;
};

type RelationPath = {
  id: string;
  d: string;
  type: RelationType;
  emphasized: boolean;
};

/** Half the node gutter — every dot centers here, so the rail lines up with them. */
const RAIL_INSET = 6;

function shortText(text: string, max = 126): string {
  const value = text.trim();
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function tick(index: number): string {
  return String(index + 1).padStart(2, "0");
}

function ClaimRow({
  claim,
  evidence,
  outgoingRelations,
  linkedRelations,
  claimsById,
  queueState,
  onRetryEvidence,
  index,
  side,
  onHoverChange,
  setCardRef,
}: {
  claim: Claim;
  evidence: Evidence[];
  outgoingRelations: Relation[];
  linkedRelations: Relation[];
  claimsById: ReadonlyMap<string, Claim>;
  queueState: EvidenceVerificationQueueState;
  onRetryEvidence: (evidenceId: string) => void;
  index: number;
  side: "A" | "B";
  onHoverChange: (hovered: boolean) => void;
  setCardRef: (node: HTMLDivElement | null) => void;
}) {
  const status = deriveClaimDisplayStatus(claim.id, evidence);
  const color = CLAIM_STATUS_COLOR[status];
  const isA = side === "A";
  const counterCount = outgoingRelations.filter(
    (relation) => relation.type === "counters",
  ).length;
  const responseCount = outgoingRelations.length - counterCount;

  const card = (
    <article
      ref={setCardRef}
      tabIndex={0}
      aria-label={`Claim ${tick(index)}: ${claim.text}`}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onFocus={() => onHoverChange(true)}
      onBlur={() => onHoverChange(false)}
      className="group/card relative min-w-0 max-w-[34rem] flex-1 border border-border border-l-2 bg-surface px-3 py-3 text-left shadow-[0_1px_2px_rgba(22,25,27,0.05)] transition-[box-shadow,transform] duration-200 hover:z-40 hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(22,25,27,0.11)] focus-within:z-40 focus-visible:shadow-[0_8px_24px_rgba(22,25,27,0.11)]"
      style={{ borderLeftColor: color }}
    >
      <span className="block text-[13px] font-medium leading-[1.45] text-foreground">
        {shortText(claim.text)}
      </span>
      <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="readout" style={{ color, letterSpacing: "0.12em" }}>
          {CLAIM_STATUS_LABEL[status]}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
          {CLAIM_NATURE_LABEL[claim.nature]}
        </span>
        <span
          className="ml-auto inline-flex items-center gap-1 border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted"
          title={`${evidence.length} attached evidence item${evidence.length === 1 ? "" : "s"}`}
        >
          <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
          {evidence.length} ev.
        </span>
      </span>
      {outgoingRelations.length > 0 && (
        <span className="mt-2 flex flex-wrap gap-1.5 border-t border-border pt-2">
          {counterCount > 0 && (
            <span className="relation-chip relation-chip-counters">
              <span aria-hidden>×</span> {counterCount} counter
            </span>
          )}
          {responseCount > 0 && (
            <span className="relation-chip relation-chip-responds">
              <span aria-hidden>↪</span> {responseCount} response
            </span>
          )}
        </span>
      )}

      <div
        className={`absolute top-full z-50 w-[min(28rem,70vw)] pt-2 opacity-0 transition-opacity duration-150 pointer-events-none group-hover/card:pointer-events-auto group-hover/card:opacity-100 group-focus-within/card:pointer-events-auto group-focus-within/card:opacity-100 ${
          isA ? "right-0" : "left-0"
        }`}
      >
        <ClaimHoverCard
          claim={claim}
          evidence={evidence}
          relations={linkedRelations}
          claimsById={claimsById}
          queueState={queueState}
          onRetry={onRetryEvidence}
        />
      </div>
    </article>
  );

  const marker = (
    <div className="flex w-3 shrink-0 justify-center">
      <span
        className="h-[7px] w-[7px] rounded-full ring-4 ring-[var(--paper)]"
        style={{ background: color }}
      />
    </div>
  );
  const leader = <div className="h-px w-5 shrink-0 bg-rule" />;
  /** The auto margin keeps the capped card pinned to its speaker's rail. */
  const label = (
    <span
      className={`readout w-6 shrink-0 text-center tabular-nums ${
        isA ? "ml-auto" : "mr-auto"
      }`}
    >
      {tick(index)}
    </span>
  );

  return (
    <div
      className="claim-enter group/row flex items-center"
      style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
    >
      {isA ? (
        <>
          {label}
          {card}
          {leader}
          {marker}
        </>
      ) : (
        <>
          {marker}
          {leader}
          {card}
          {label}
        </>
      )}
    </div>
  );
}

export function DebateGraph({
  claims,
  evidence,
  relations,
  queueState,
  onRetryEvidence,
  speakerAName,
  speakerBName,
  onRenameA,
  onRenameB,
}: DebateGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<HTMLDivElement>(null);
  const headARef = useRef<HTMLSpanElement>(null);
  const headBRef = useRef<HTMLSpanElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const [fork, setFork] = useState<{ a: string; b: string } | null>(null);
  const [relationPaths, setRelationPaths] = useState<RelationPath[]>([]);
  /** Hover is the only claim focus now — it drives detail and path emphasis. */
  const [hoveredClaimId, setHoveredClaimId] = useState<string | null>(null);

  const claimById = useMemo(
    () => new Map(claims.map((claim) => [claim.id, claim])),
    [claims],
  );
  const evidenceByClaimId = useMemo(() => {
    const index = new Map<string, Evidence[]>();
    for (const item of evidence) {
      for (const claimId of item.supportsClaimIds) {
        const attached = index.get(claimId);
        if (attached) attached.push(item);
        else index.set(claimId, [item]);
      }
    }
    return index;
  }, [evidence]);
  const validRelations = useMemo(
    () =>
      relations.filter(
        (relation) =>
          claimById.has(relation.from) && claimById.has(relation.to),
      ),
    [claimById, relations],
  );
  const outgoingByClaimId = useMemo(() => {
    const index = new Map<string, Relation[]>();
    for (const relation of validRelations) {
      const outgoing = index.get(relation.from);
      if (outgoing) outgoing.push(relation);
      else index.set(relation.from, [relation]);
    }
    return index;
  }, [validRelations]);
  const linkedByClaimId = useMemo(() => {
    const index = new Map<string, Relation[]>();
    for (const relation of validRelations) {
      for (const claimId of new Set([relation.from, relation.to])) {
        const linked = index.get(claimId);
        if (linked) linked.push(relation);
        else index.set(claimId, [relation]);
      }
    }
    return index;
  }, [validRelations]);

  const { claimsA, claimsB } = useMemo(() => {
    const sorted = [...claims].sort((x, y) => x.createdAt - y.createdAt);
    return {
      // UNKNOWN remains visible until diarization resolves it.
      claimsA: sorted.filter((claim) => claim.speaker !== "B"),
      claimsB: sorted.filter((claim) => claim.speaker === "B"),
    };
  }, [claims]);

  const setCardRef = useCallback(
    (id: string, node: HTMLDivElement | null) => {
      if (node) cardRefs.current.set(id, node);
      else cardRefs.current.delete(id);
    },
    [],
  );

  const measure = useCallback(() => {
    const container = containerRef.current;
    const origin = originRef.current;
    const headA = headARef.current;
    const headB = headBRef.current;
    if (!container || !origin || !headA || !headB) return;

    const containerRect = container.getBoundingClientRect();
    const originRect = origin.getBoundingClientRect();
    const headARect = headA.getBoundingClientRect();
    const headBRect = headB.getBoundingClientRect();
    const originPoint = {
      x: originRect.left + originRect.width / 2 - containerRect.left,
      y: originRect.bottom - containerRect.top,
    };
    const center = (rect: DOMRect) => ({
      x: rect.left + rect.width / 2 - containerRect.left,
      y: rect.top + rect.height / 2 - containerRect.top,
    });
    const forkCurve = (
      from: { x: number; y: number },
      to: { x: number; y: number },
    ) => {
      const midY = from.y + (to.y - from.y) * 0.55;
      return `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
    };
    setFork({
      a: forkCurve(originPoint, center(headARect)),
      b: forkCurve(originPoint, center(headBRect)),
    });

    const nextPaths: RelationPath[] = [];
    for (const relation of validRelations) {
      const fromNode = cardRefs.current.get(relation.from);
      const toNode = cardRefs.current.get(relation.to);
      const fromClaim = claimById.get(relation.from);
      const toClaim = claimById.get(relation.to);
      if (!fromNode || !toNode || !fromClaim || !toClaim) continue;

      const fromRect = fromNode.getBoundingClientRect();
      const toRect = toNode.getBoundingClientRect();
      const fromSide = fromClaim.speaker === "B" ? "B" : "A";
      const toSide = toClaim.speaker === "B" ? "B" : "A";
      const from = {
        x:
          (fromSide === "A" ? fromRect.right : fromRect.left) -
          containerRect.left,
        y: fromRect.top + fromRect.height / 2 - containerRect.top,
      };
      const to = {
        x:
          (toSide === "A" ? toRect.right : toRect.left) -
          containerRect.left,
        y: toRect.top + toRect.height / 2 - containerRect.top,
      };
      const midX =
        fromSide === toSide
          ? containerRect.width / 2 + (fromSide === "A" ? -18 : 18)
          : (from.x + to.x) / 2;
      nextPaths.push({
        id: relation.id,
        type: relation.type,
        emphasized:
          hoveredClaimId === relation.from || hoveredClaimId === relation.to,
        d: `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`,
      });
    }
    setRelationPaths(nextPaths);
  }, [claimById, hoveredClaimId, validRelations]);

  useLayoutEffect(() => {
    measure();
  }, [claimsA.length, claimsB.length, measure, speakerAName, speakerBName]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    for (const card of cardRefs.current.values()) observer.observe(card);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div
      ref={containerRef}
      className="relative mx-auto w-full max-w-[1600px] px-6 py-12 md:px-12"
    >
      <svg
        className="pointer-events-none absolute inset-0 z-[5] h-full w-full overflow-visible"
        aria-hidden
      >
        <defs>
          <marker id="relation-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <path d="M0,0 L6,3.5 L0,7" fill="none" stroke="context-stroke" strokeWidth="1" />
          </marker>
        </defs>
        {fork && (
          <>
            <path d={fork.a} fill="none" stroke="var(--speaker-a)" strokeWidth={1.25} strokeOpacity={0.5} />
            <path d={fork.b} fill="none" stroke="var(--speaker-b)" strokeWidth={1.25} strokeOpacity={0.5} />
          </>
        )}
        {relationPaths.map((path) => (
          <path
            key={path.id}
            d={path.d}
            fill="none"
            markerEnd="url(#relation-arrow)"
            className={`relation-path relation-path-${path.type}`}
            strokeWidth={path.emphasized ? 2 : 1.25}
            opacity={path.emphasized ? 1 : 0.72}
          />
        ))}
      </svg>

      <div className="relative z-10 flex justify-center">
        <div ref={originRef} className="h-[9px] w-[9px] rotate-45 bg-foreground" />
      </div>
      <div className="pointer-events-none absolute left-1/2 top-14 z-10 flex -translate-x-1/2 gap-3 whitespace-nowrap">
        <span className="relation-key relation-key-counters">Counters</span>
        <span className="relation-key relation-key-responds">Responds</span>
      </div>

      <div className="relative z-10 mt-20 grid grid-cols-2 gap-[clamp(5rem,18vw,17rem)]">
        <div className="relative">
          <div
            aria-hidden
            className="absolute bottom-0 top-3 w-px"
            style={{ right: RAIL_INSET - 0.5, background: "var(--rule)" }}
          />
          <div className="relative flex items-center">
            <input
              value={speakerAName}
              onChange={(event) => onRenameA(event.target.value)}
              aria-label="Rename speaker A"
              spellCheck={false}
              className="min-w-0 flex-1 truncate rounded-sm bg-transparent pr-3 text-right font-display text-2xl leading-none text-speaker-a outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--speaker-a)_7%,transparent)] focus:bg-[color-mix(in_srgb,var(--speaker-a)_7%,transparent)] md:text-[2rem]"
            />
            <div className="h-px w-5 shrink-0 bg-speaker-a opacity-50" />
            <div className="flex w-3 shrink-0 justify-center">
              <span ref={headARef} className="h-[9px] w-[9px] rounded-full bg-speaker-a ring-4 ring-[var(--paper)]" />
            </div>
          </div>
          <div className="mt-9 flex flex-col gap-4">
            {claimsA.map((claim, index) => (
              <ClaimRow
                key={claim.id}
                claim={claim}
                evidence={evidenceByClaimId.get(claim.id) ?? []}
                outgoingRelations={outgoingByClaimId.get(claim.id) ?? []}
                linkedRelations={linkedByClaimId.get(claim.id) ?? []}
                claimsById={claimById}
                queueState={queueState}
                onRetryEvidence={onRetryEvidence}
                index={index}
                side="A"
                onHoverChange={(hovered) =>
                  setHoveredClaimId(hovered ? claim.id : null)
                }
                setCardRef={(node) => setCardRef(claim.id, node)}
              />
            ))}
          </div>
        </div>

        <div className="relative">
          <div
            aria-hidden
            className="absolute bottom-0 top-3 w-px"
            style={{ left: RAIL_INSET - 0.5, background: "var(--rule)" }}
          />
          <div className="relative flex items-center">
            <div className="flex w-3 shrink-0 justify-center">
              <span ref={headBRef} className="h-[9px] w-[9px] rounded-full bg-speaker-b ring-4 ring-[var(--paper)]" />
            </div>
            <div className="h-px w-5 shrink-0 bg-speaker-b opacity-50" />
            <input
              value={speakerBName}
              onChange={(event) => onRenameB(event.target.value)}
              aria-label="Rename speaker B"
              spellCheck={false}
              className="min-w-0 flex-1 truncate rounded-sm bg-transparent pl-3 text-left font-display text-2xl leading-none text-speaker-b outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--speaker-b)_7%,transparent)] focus:bg-[color-mix(in_srgb,var(--speaker-b)_7%,transparent)] md:text-[2rem]"
            />
          </div>
          <div className="mt-9 flex flex-col gap-4">
            {claimsB.map((claim, index) => (
              <ClaimRow
                key={claim.id}
                claim={claim}
                evidence={evidenceByClaimId.get(claim.id) ?? []}
                outgoingRelations={outgoingByClaimId.get(claim.id) ?? []}
                linkedRelations={linkedByClaimId.get(claim.id) ?? []}
                claimsById={claimById}
                queueState={queueState}
                onRetryEvidence={onRetryEvidence}
                index={index}
                side="B"
                onHoverChange={(hovered) =>
                  setHoveredClaimId(hovered ? claim.id : null)
                }
                setCardRef={(node) => setCardRef(claim.id, node)}
              />
            ))}
          </div>
        </div>
      </div>

      {claims.length === 0 && (
        <p className="pointer-events-none relative z-10 mx-auto mt-20 max-w-xs text-center text-sm leading-relaxed text-muted">
          Open the floor and start talking. Each claim is pinned to its
          speaker&rsquo;s branch in the order it was made.
        </p>
      )}
    </div>
  );
}
