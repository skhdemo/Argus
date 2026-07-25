import type { CSSProperties, ReactNode } from "react";

import type { MomentumState } from "@/hooks/useMomentum";

type MomentumBackdropProps = {
  momentum: MomentumState;
  children: ReactNode;
};

/**
 * CSS custom properties aren't in React's CSSProperties type — this is the
 * standard escape hatch rather than casting the whole style object to `any`.
 */
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
      className="momentum-backdrop relative flex flex-1 flex-col overflow-hidden rounded-md border border-border"
      style={style}
    >
      {momentum.isDecisive && momentum.leader !== "tied" && (
        <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-border bg-surface/80 px-4 py-1 font-mono text-xs uppercase tracking-wide backdrop-blur">
          Speaker {momentum.leader} is winning
        </div>
      )}
      <div className="relative z-10 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}
