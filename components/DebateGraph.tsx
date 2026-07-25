"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";

import type { Claim, ClaimType, Edge } from "@/lib/types/debate";

type DebateGraphProps = {
  claims: Claim[];
  edges: Edge[];
  speakerAName: string;
  speakerBName: string;
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

function shortText(text: string, max = 72): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function ClaimNode({ claim }: { claim: Claim }) {
  return (
    <div className="group relative w-full max-w-[250px]">
      <div
        className="rounded-soft border-2 bg-surface px-3.5 py-3 text-sm leading-snug text-foreground shadow-[0_1px_0_rgba(18,32,43,0.04)]"
        style={{ borderColor: TYPE_COLOR[claim.type] }}
      >
        <p className="line-clamp-3 font-medium">{shortText(claim.text)}</p>
        <p
          className="mt-1.5 text-[11px] font-semibold tracking-wide"
          style={{ color: TYPE_COLOR[claim.type] }}
        >
          {TYPE_LABEL[claim.type]}
        </p>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-72 -translate-x-1/2 rounded-soft border border-border bg-surface p-3.5 opacity-0 shadow-[0_12px_30px_rgba(18,32,43,0.12)] transition-opacity duration-150 group-hover:opacity-100">
        <p className="text-sm leading-relaxed">{claim.text}</p>
        <p className="mt-2 text-[11px] font-medium text-muted">
          {TYPE_LABEL[claim.type]}
          {claim.sourceExcerpt
            ? ` · “${shortText(claim.sourceExcerpt, 48)}”`
            : ""}
        </p>
      </div>
    </div>
  );
}

export function DebateGraph({
  claims,
  edges,
  speakerAName,
  speakerBName,
}: DebateGraphProps) {
  void edges;

  const containerRef = useRef<HTMLDivElement>(null);
  const topicRef = useRef<HTMLDivElement>(null);
  const aNameRef = useRef<HTMLParagraphElement>(null);
  const bNameRef = useRef<HTMLParagraphElement>(null);
  const [lines, setLines] = useState<{ a: string; b: string } | null>(null);

  const { claimsA, claimsB } = useMemo(() => {
    const sorted = [...claims].sort((a, b) => a.createdAt - b.createdAt);
    return {
      claimsA: sorted.filter((c) => c.speaker === "A"),
      claimsB: sorted.filter((c) => c.speaker === "B"),
    };
  }, [claims]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const topic = topicRef.current;
    const aName = aNameRef.current;
    const bName = bNameRef.current;
    if (!container || !topic || !aName || !bName) return;

    const c = container.getBoundingClientRect();
    const t = topic.getBoundingClientRect();
    const a = aName.getBoundingClientRect();
    const b = bName.getBoundingClientRect();

    const start = {
      x: t.left + t.width / 2 - c.left,
      y: t.bottom - c.top,
    };
    const endA = {
      x: a.left + a.width / 2 - c.left,
      y: a.top - c.top,
    };
    const endB = {
      x: b.left + b.width / 2 - c.left,
      y: b.top - c.top,
    };

    const curve = (
      from: { x: number; y: number },
      to: { x: number; y: number },
    ) => {
      const midY = from.y + (to.y - from.y) * 0.5;
      return `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
    };

    setLines({ a: curve(start, endA), b: curve(start, endB) });
  }, [claimsA.length, claimsB.length, speakerAName, speakerBName]);

  return (
    <div ref={containerRef} className="relative w-full min-h-[60vh]">
      <svg
        className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
        aria-hidden
      >
        {lines && (
          <>
            <path
              d={lines.a}
              fill="none"
              stroke="var(--speaker-a)"
              strokeWidth={1.75}
              strokeOpacity={0.35}
            />
            <path
              d={lines.b}
              fill="none"
              stroke="var(--speaker-b)"
              strokeWidth={1.75}
              strokeOpacity={0.35}
            />
          </>
        )}
      </svg>

      <div className="relative z-10 flex justify-center">
        <div
          ref={topicRef}
          className="h-3 w-3 rounded-full bg-accent shadow-[0_0_0_6px_var(--accent-soft)]"
        />
      </div>

      <div className="relative z-10 mt-12 grid grid-cols-2 items-start gap-4 md:gap-16">
        <div className="relative flex flex-col items-center pb-20">
          {claimsA.length > 0 && (
            <div
              aria-hidden
              className="absolute bottom-10 left-1/2 top-10 w-px -translate-x-1/2 bg-speaker-a/25"
            />
          )}
          <p
            ref={aNameRef}
            className="relative z-10 font-display text-2xl font-semibold tracking-tight text-speaker-a md:text-3xl"
          >
            {speakerAName}
          </p>
          <div className="relative z-10 mt-6 flex w-full flex-col items-center gap-4">
            {claimsA.map((claim) => (
              <ClaimNode key={claim.id} claim={claim} />
            ))}
          </div>
        </div>

        <div className="relative flex flex-col items-center pb-20">
          {claimsB.length > 0 && (
            <div
              aria-hidden
              className="absolute bottom-10 left-1/2 top-10 w-px -translate-x-1/2 bg-speaker-b/25"
            />
          )}
          <p
            ref={bNameRef}
            className="relative z-10 font-display text-2xl font-semibold tracking-tight text-speaker-b md:text-3xl"
          >
            {speakerBName}
          </p>
          <div className="relative z-10 mt-6 flex w-full flex-col items-center gap-4">
            {claimsB.map((claim) => (
              <ClaimNode key={claim.id} claim={claim} />
            ))}
          </div>
        </div>
      </div>

      {claims.length === 0 && (
        <p className="pointer-events-none absolute left-1/2 top-[48%] w-64 -translate-x-1/2 text-center text-sm text-muted">
          Press Start. Claims grow down each branch.
        </p>
      )}
    </div>
  );
}
