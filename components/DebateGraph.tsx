"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { Claim, ClaimType, Edge } from "@/lib/types/debate";

type DebateGraphProps = {
  claims: Claim[];
  edges: Edge[];
  speakerAName: string;
  speakerBName: string;
  onRenameA: (name: string) => void;
  onRenameB: (name: string) => void;
};

const TYPE_COLOR: Record<ClaimType, string> = {
  supported: "var(--claim-supported)",
  assumption: "var(--claim-assumption)",
  needs_evidence: "var(--claim-needs-evidence)",
  counterargument: "var(--claim-counterargument)",
};

const TYPE_LABEL: Record<ClaimType, string> = {
  supported: "Supported",
  assumption: "Assumption",
  needs_evidence: "Needs evidence",
  counterargument: "Counterargument",
};

/** Half the node gutter — every dot centers here, so the rail lines up with them. */
const RAIL_INSET = 6;

function shortText(text: string, max = 96): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function tick(index: number): string {
  return String(index + 1).padStart(2, "0");
}

/**
 * One claim, pinned to its speaker's time axis. `side` decides which way the
 * card hangs off the rail — and therefore which way its detail opens, so a
 * popover never runs off the outer edge of the screen.
 */
function ClaimRow({
  claim,
  index,
  side,
}: {
  claim: Claim;
  index: number;
  side: "A" | "B";
}) {
  const color = TYPE_COLOR[claim.type];
  const isA = side === "A";

  const card = (
    <article
      className="group/card relative flex-1 border-l-2 bg-surface py-2.5 pl-3 pr-3 text-left shadow-[0_1px_2px_rgba(22,25,27,0.05)] transition-shadow duration-200 hover:shadow-[0_6px_20px_rgba(22,25,27,0.10)]"
      style={{ borderColor: color }}
    >
      <p className="text-[13px] font-medium leading-[1.45] text-foreground">
        {shortText(claim.text)}
      </p>
      <p
        className="readout mt-1.5"
        style={{ color, letterSpacing: "0.14em" }}
      >
        {TYPE_LABEL[claim.type]}
      </p>

      {/* Full text on hover. Opens inward, toward the centre of the board. */}
      <div
        className={`pointer-events-none absolute top-1/2 z-40 w-[19rem] -translate-y-1/2 border border-border bg-surface p-4 opacity-0 shadow-[0_16px_40px_rgba(22,25,27,0.16)] transition-opacity duration-150 group-hover/card:opacity-100 ${
          isA ? "left-full ml-4" : "right-full mr-4"
        }`}
      >
        <p className="readout mb-2" style={{ color }}>
          {TYPE_LABEL[claim.type]}
        </p>
        <p className="text-sm leading-relaxed text-foreground">{claim.text}</p>
        {claim.sourceExcerpt && (
          <p className="mt-3 border-t border-border pt-3 text-[13px] italic leading-relaxed text-muted">
            “{claim.sourceExcerpt}”
          </p>
        )}
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

  const leader = (
    <div className="h-px w-5 shrink-0" style={{ background: "var(--rule)" }} />
  );

  const label = (
    <span className="readout w-6 shrink-0 text-center tabular-nums">
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
  edges,
  speakerAName,
  speakerBName,
  onRenameA,
  onRenameB,
}: DebateGraphProps) {
  void edges;

  const containerRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<HTMLDivElement>(null);
  const headARef = useRef<HTMLSpanElement>(null);
  const headBRef = useRef<HTMLSpanElement>(null);
  const [fork, setFork] = useState<{ a: string; b: string } | null>(null);

  const { claimsA, claimsB } = useMemo(() => {
    const sorted = [...claims].sort((x, y) => x.createdAt - y.createdAt);
    return {
      claimsA: sorted.filter((c) => c.speaker === "A"),
      claimsB: sorted.filter((c) => c.speaker === "B"),
    };
  }, [claims]);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const origin = originRef.current;
    const headA = headARef.current;
    const headB = headBRef.current;
    if (!container || !origin || !headA || !headB) return;

    const c = container.getBoundingClientRect();
    const o = origin.getBoundingClientRect();
    const a = headA.getBoundingClientRect();
    const b = headB.getBoundingClientRect();

    const from = {
      x: o.left + o.width / 2 - c.left,
      y: o.bottom - c.top,
    };
    const to = (r: DOMRect) => ({
      x: r.left + r.width / 2 - c.left,
      y: r.top + r.height / 2 - c.top,
    });

    // Vertical-tangent cubic: leaves the motion straight down, arrives at the
    // rail straight down, so the fork reads as one continuous descent.
    const curve = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
      const mid = p1.y + (p2.y - p1.y) * 0.55;
      return `M ${p1.x} ${p1.y} C ${p1.x} ${mid}, ${p2.x} ${mid}, ${p2.x} ${p2.y}`;
    };

    setFork({ a: curve(from, to(a)), b: curve(from, to(b)) });
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, claimsA.length, claimsB.length, speakerAName, speakerBName]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [measure]);

  const isEmpty = claims.length === 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
        aria-hidden
      >
        {fork && (
          <>
            <path
              d={fork.a}
              fill="none"
              stroke="var(--speaker-a)"
              strokeWidth={1.25}
              strokeOpacity={0.5}
            />
            <path
              d={fork.b}
              fill="none"
              stroke="var(--speaker-b)"
              strokeWidth={1.25}
              strokeOpacity={0.5}
            />
          </>
        )}
      </svg>

      {/* The motion — where both branches originate. */}
      <div className="relative z-10 flex justify-center">
        <div
          ref={originRef}
          className="h-[9px] w-[9px] rotate-45 bg-foreground"
        />
      </div>

      {/* The centre gutter is wide on purpose: it's where the fork lives and
          where a claim's full text opens on hover, so neither ever collides
          with the other speaker's column. */}
      <div className="relative z-10 mt-14 grid grid-cols-2 gap-8 md:gap-[clamp(6rem,20vw,21rem)]">
        {/* ── Speaker A: rail on the inner edge, cards hanging outward ── */}
        <div className="relative">
          <div
            aria-hidden
            className="absolute top-3 bottom-0 w-px"
            style={{ right: RAIL_INSET - 0.5, background: "var(--rule)" }}
          />

          <div className="relative flex items-center">
            <input
              value={speakerAName}
              onChange={(e) => onRenameA(e.target.value)}
              aria-label="Rename speaker A"
              spellCheck={false}
              className="min-w-0 flex-1 truncate rounded-sm bg-transparent pr-3 text-right font-display text-2xl leading-none text-speaker-a outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--speaker-a)_7%,transparent)] focus:bg-[color-mix(in_srgb,var(--speaker-a)_7%,transparent)] md:text-[2rem]"
            />
            <div className="h-px w-5 shrink-0" style={{ background: "var(--speaker-a)", opacity: 0.5 }} />
            <div className="flex w-3 shrink-0 justify-center">
              <span
                ref={headARef}
                className="h-[9px] w-[9px] rounded-full ring-4 ring-[var(--paper)]"
                style={{ background: "var(--speaker-a)" }}
              />
            </div>
          </div>

          <div className="mt-9 flex flex-col gap-4">
            {claimsA.map((claim, i) => (
              <ClaimRow key={claim.id} claim={claim} index={i} side="A" />
            ))}
          </div>
        </div>

        {/* ── Speaker B: mirrored ── */}
        <div className="relative">
          <div
            aria-hidden
            className="absolute top-3 bottom-0 w-px"
            style={{ left: RAIL_INSET - 0.5, background: "var(--rule)" }}
          />

          <div className="relative flex items-center">
            <div className="flex w-3 shrink-0 justify-center">
              <span
                ref={headBRef}
                className="h-[9px] w-[9px] rounded-full ring-4 ring-[var(--paper)]"
                style={{ background: "var(--speaker-b)" }}
              />
            </div>
            <div className="h-px w-5 shrink-0" style={{ background: "var(--speaker-b)", opacity: 0.5 }} />
            <input
              value={speakerBName}
              onChange={(e) => onRenameB(e.target.value)}
              aria-label="Rename speaker B"
              spellCheck={false}
              className="min-w-0 flex-1 truncate rounded-sm bg-transparent pl-3 text-left font-display text-2xl leading-none text-speaker-b outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--speaker-b)_7%,transparent)] focus:bg-[color-mix(in_srgb,var(--speaker-b)_7%,transparent)] md:text-[2rem]"
            />
          </div>

          <div className="mt-9 flex flex-col gap-4">
            {claimsB.map((claim, i) => (
              <ClaimRow key={claim.id} claim={claim} index={i} side="B" />
            ))}
          </div>
        </div>
      </div>

      {isEmpty && (
        <p className="pointer-events-none relative z-10 mx-auto mt-20 max-w-xs text-center text-sm leading-relaxed text-muted">
          Open the floor and start talking. Each claim is pinned to its speaker&rsquo;s
          branch in the order it was made.
        </p>
      )}
    </div>
  );
}
