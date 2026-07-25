import type { CSSProperties, ReactNode } from "react";

import type { UseMomentumResult } from "@/hooks/useMomentum";

type MomentumBackdropProps = {
  momentum: UseMomentumResult;
  speakerAName: string;
  speakerBName: string;
  children: ReactNode;
};

type MomentumCSSProperties = CSSProperties & {
  "--momentum-a"?: number;
  "--momentum-b"?: number;
};

export function MomentumBackdrop({
  momentum,
  speakerAName,
  speakerBName,
  children,
}: MomentumBackdropProps) {
  const style: MomentumCSSProperties = {
    "--momentum-a": momentum.ratioA,
    "--momentum-b": momentum.ratioB,
  };

  return (
    <section
      className="momentum-backdrop relative flex min-h-[420px] flex-1 flex-col border border-border bg-surface"
      style={style}
    >
      <div className="relative z-20 flex items-center justify-between gap-4 border-b border-border bg-[color-mix(in_srgb,var(--surface)_86%,transparent)] px-4 py-3 backdrop-blur-sm">
        <div className="min-w-0">
          <p className="readout truncate text-speaker-a">{speakerAName}</p>
          <p className="mt-1 font-display text-xl leading-none text-speaker-a">
            {Math.round(momentum.ratioA * 100)}
          </p>
        </div>
        <div className="text-center">
          <p className="readout">
            Live momentum
            {momentum.isLoading ? " · refreshing" : ""}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {momentum.error
              ? "Last stable score"
              : momentum.isDecisive && momentum.leader !== "tied"
                ? `${momentum.leader === "A" ? speakerAName : speakerBName} has the edge`
                : "Structural balance"}
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="readout truncate text-speaker-b">{speakerBName}</p>
          <p className="mt-1 font-display text-xl leading-none text-speaker-b">
            {Math.round(momentum.ratioB * 100)}
          </p>
        </div>
      </div>
      <div className="relative z-10 flex-1 overflow-x-auto overflow-y-hidden">
        {children}
      </div>
    </section>
  );
}
