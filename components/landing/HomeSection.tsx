"use client";

import type { ClaimType } from "@/lib/types/debate";

const LEGEND: { type: ClaimType; label: string }[] = [
  { type: "supported", label: "Supported" },
  { type: "assumption", label: "Assumption" },
  { type: "needs_evidence", label: "Needs evidence" },
  { type: "counterargument", label: "Counterargument" },
];

const TYPE_VAR: Record<ClaimType, string> = {
  supported: "var(--claim-supported)",
  assumption: "var(--claim-assumption)",
  needs_evidence: "var(--claim-needs-evidence)",
  counterargument: "var(--claim-counterargument)",
};

/** A claim as it appears on the board, drawn at schematic scale. */
function DemoClaim({
  x,
  y,
  side,
  type,
  text,
  delay,
}: {
  x: number;
  y: number;
  side: "A" | "B";
  type: ClaimType;
  text: string;
  delay: number;
}) {
  const w = 132;
  const left = side === "A" ? x - 22 - w : x + 22;
  const color = TYPE_VAR[type];

  return (
    <g className="settle" style={{ ["--delay" as string]: `${delay}ms` }}>
      <line
        x1={side === "A" ? x - 22 : x + 4}
        y1={y}
        x2={side === "A" ? x - 4 : x + 22}
        y2={y}
        stroke="var(--rule)"
        strokeWidth={1}
      />
      <circle cx={x} cy={y} r={3.5} fill={color} />
      <rect
        x={left}
        y={y - 15}
        width={w}
        height={30}
        fill="var(--surface)"
        stroke="var(--border)"
        strokeWidth={1}
      />
      <rect x={left} y={y - 15} width={2} height={30} fill={color} />
      <text
        x={left + 10}
        y={y + 4}
        fill="var(--foreground)"
        style={{ font: "500 11px var(--font-body), sans-serif" }}
      >
        {text}
      </text>
    </g>
  );
}

/**
 * The hero is the product, not a picture of it: the fork draws itself and
 * claims land on their branches exactly as they do on the live board.
 */
function BoardSchematic() {
  return (
    <svg
      viewBox="0 0 460 340"
      className="h-auto w-full"
      role="img"
      aria-label="Two speaker branches descending from a debate topic, with claims pinned to each branch in order."
    >
      {/* The rotation lives on the inner rect: `.settle` animates transform,
          so putting both on one node would cancel the diamond out. */}
      <g className="settle" style={{ ["--delay" as string]: "80ms" }}>
        <rect
          x={205}
          y={14}
          width={11}
          height={11}
          fill="var(--foreground)"
          transform="rotate(45 210.5 19.5)"
        />
      </g>

      <path
        d="M210 30 C 210 66, 150 66, 150 96"
        fill="none"
        stroke="var(--speaker-a)"
        strokeOpacity={0.5}
        strokeWidth={1.25}
        className="draw"
        style={{ ["--len" as string]: 110, ["--delay" as string]: "220ms" }}
      />
      <path
        d="M210 30 C 210 66, 290 66, 290 96"
        fill="none"
        stroke="var(--speaker-b)"
        strokeOpacity={0.5}
        strokeWidth={1.25}
        className="draw"
        style={{ ["--len" as string]: 110, ["--delay" as string]: "220ms" }}
      />

      <circle
        cx={150}
        cy={100}
        r={4.5}
        fill="var(--speaker-a)"
        className="settle"
        style={{ ["--delay" as string]: "760ms" }}
      />
      <circle
        cx={290}
        cy={100}
        r={4.5}
        fill="var(--speaker-b)"
        className="settle"
        style={{ ["--delay" as string]: "760ms" }}
      />

      <line
        x1={150}
        y1={106}
        x2={150}
        y2={318}
        stroke="var(--rule)"
        strokeWidth={1}
        className="draw"
        style={{ ["--len" as string]: 215, ["--delay" as string]: "820ms" }}
      />
      <line
        x1={290}
        y1={106}
        x2={290}
        y2={318}
        stroke="var(--rule)"
        strokeWidth={1}
        className="draw"
        style={{ ["--len" as string]: 215, ["--delay" as string]: "820ms" }}
      />

      <DemoClaim x={150} y={150} side="A" type="needs_evidence" text="Remote work lifts output" delay={1150} />
      <DemoClaim x={290} y={200} side="B" type="counterargument" text="Rooms decide better" delay={1500} />
      <DemoClaim x={150} y={252} side="A" type="supported" text="2023 meta-analysis: +4%" delay={1850} />
    </svg>
  );
}

export function HomeSection() {
  return (
    <section className="relative flex min-h-[100svh] flex-col px-6 py-8 md:px-12 md:py-10">
      <header className="flex items-baseline justify-between border-b border-rule pb-4">
        <span className="font-display text-xl leading-none">Argus</span>
        <span className="readout">Live debate reasoning mapper</span>
      </header>

      <div className="grid flex-1 items-center gap-14 py-14 lg:grid-cols-[1.05fr_1fr] lg:gap-20">
        <div className="max-w-xl">
          <p className="readout mb-7">Every argument has a shape</p>

          <h1 className="font-display text-[clamp(2.75rem,7vw,5.25rem)] leading-[0.95] tracking-[-0.02em] text-foreground">
            Argus draws it
            <br />
            while you talk.
          </h1>

          <p className="mt-8 max-w-md text-[1.0625rem] leading-relaxed text-muted">
            Two people debate out loud. Argus listens, pulls out each claim, and
            pins it to whoever said it — so the structure underneath the argument
            is visible while it&rsquo;s still being made.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3">
            <a
              href="#debate"
              className="inline-flex items-center gap-2.5 bg-foreground px-7 py-3.5 text-sm font-medium text-[var(--paper)] transition-opacity hover:opacity-85"
            >
              Open the floor
              <span aria-hidden className="text-base leading-none">↓</span>
            </a>
            <span className="readout">Desktop Chrome · microphone required</span>
          </div>

          <dl className="mt-14 border-t border-rule pt-6">
            <dt className="readout mb-3.5">Each claim is marked</dt>
            <dd className="flex flex-wrap gap-x-6 gap-y-2.5">
              {LEGEND.map(({ type, label }) => (
                <span key={type} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-[7px] w-[7px] rounded-full"
                    style={{ background: TYPE_VAR[type] }}
                  />
                  <span className="text-[13px] text-muted">{label}</span>
                </span>
              ))}
            </dd>
          </dl>
        </div>

        <div className="lg:pl-4">
          <BoardSchematic />
        </div>
      </div>
    </section>
  );
}
