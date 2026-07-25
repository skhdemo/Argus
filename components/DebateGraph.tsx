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
    <div className="group relative w-full max-w-[240px]">
      <div
        className="border-2 bg-surface px-3 py-2.5 text-sm leading-snug text-foreground"
        style={{ borderColor: TYPE_COLOR[claim.type] }}
      >
        <p className="line-clamp-3">{shortText(claim.text)}</p>
        <p
          className="mt-1.5 font-mono text-[10px] uppercase tracking-wide"
          style={{ color: TYPE_COLOR[claim.type] }}
        >
          {TYPE_LABEL[claim.type]}
        </p>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-72 -translate-x-1/2 border border-line bg-surface p-3 opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-opacity duration-150 group-hover:opacity-100">
        <p className="text-sm leading-relaxed">{claim.text}</p>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-muted">
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
              stroke="var(--line)"
              strokeWidth={1.5}
              strokeOpacity={0.5}
            />
            <path
              d={lines.b}
              fill="none"
              stroke="var(--line)"
              strokeWidth={1.5}
              strokeOpacity={0.5}
            />
          </>
        )}
      </svg>

      {/* Topic fork point (topic text is above, in the workspace header) */}
      <div className="relative z-10 flex justify-center">
        <div ref={topicRef} className="h-2.5 w-2.5 rounded-full bg-line" />
      </div>

      <div className="relative z-10 mt-12 grid grid-cols-2 items-start gap-4 md:gap-16">
        <div className="relative flex flex-col items-center pb-20">
          {claimsA.length > 0 && (
            <div
              aria-hidden
              className="absolute bottom-10 left-1/2 top-9 w-px -translate-x-1/2 bg-speaker-a/30"
            />
          )}
          <p
            ref={aNameRef}
            className="relative z-10 font-display text-2xl tracking-tight text-speaker-a md:text-3xl"
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
              className="absolute bottom-10 left-1/2 top-9 w-px -translate-x-1/2 bg-speaker-b/30"
            />
          )}
          <p
            ref={bNameRef}
            className="relative z-10 font-display text-2xl tracking-tight text-speaker-b md:text-3xl"
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
