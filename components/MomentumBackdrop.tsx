import type { CSSProperties, ReactNode } from "react";

import type { MomentumState } from "@/hooks/useMomentum";

type MomentumBackdropProps = {
  momentum: MomentumState;
  children: ReactNode;
};

type MomentumCSSProperties = CSSProperties & {
  "--momentum-a"?: number;
  "--momentum-b"?: number;
};

export function MomentumBackdrop({ momentum, children }: MomentumBackdropProps) {
  const style: MomentumCSSProperties = {
    "--momentum-a": momentum.ratioA,
    "--momentum-b": momentum.ratioB,
  };

  return (
    <section
      className="momentum-backdrop relative flex min-h-[420px] flex-1 flex-col overflow-hidden border border-border bg-surface"
      style={style}
    >
      {momentum.isDecisive && momentum.leader !== "tied" && (
        <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 border border-border bg-surface-elevated/90 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft backdrop-blur">
          Momentum · Speaker {momentum.leader}
        </div>
      )}
      <div className="relative z-10 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}
