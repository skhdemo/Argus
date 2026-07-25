import type { ReactNode } from "react";

import type { Claim, ClaimType, Edge } from "@/lib/types/debate";

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

const EDGE_TYPE_LABEL: Record<Edge["type"], string> = {
  supports: "Supports",
  contradicts: "Contradicts",
  responds_to: "Responds to",
};

type ClaimInspectorProps = {
  claim: Claim | null;
  edges: Edge[];
  claimsById: Map<string, Claim>;
  onClose: () => void;
  /** Slot for BE2's future fallacy badges — unused until BE2 wires it. */
  renderBadges?: (claim: Claim) => ReactNode;
};

export function ClaimInspector({
  claim,
  edges,
  claimsById,
  onClose,
  renderBadges,
}: ClaimInspectorProps) {
  if (!claim) return null;

  const linkedEdges = edges
    .filter((edge) => edge.from === claim.id || edge.to === claim.id)
    .map((edge) => {
      const otherId = edge.from === claim.id ? edge.to : edge.from;
      const direction = edge.from === claim.id ? "→" : "←";
      return { edge, direction, other: claimsById.get(otherId) };
    });

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 font-mono text-xs"
            style={{
              color: claim.speaker === "A" ? "var(--speaker-a)" : "var(--speaker-b)",
              border: `1px solid ${claim.speaker === "A" ? "var(--speaker-a)" : "var(--speaker-b)"}`,
            }}
          >
            Speaker {claim.speaker}
          </span>
          <span
            className="rounded-full px-2 py-0.5 font-mono text-xs"
            style={{
              color: CLAIM_TYPE_COLOR_VAR[claim.type],
              border: `1px solid ${CLAIM_TYPE_COLOR_VAR[claim.type]}`,
            }}
          >
            {CLAIM_TYPE_LABEL[claim.type]}
          </span>
          {renderBadges?.(claim)}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-muted transition-colors hover:text-foreground"
        >
          ×
        </button>
      </div>

      <p className="text-sm leading-relaxed">{claim.text}</p>

      <div className="border-t border-border pt-3">
        <p className="mb-2 font-mono text-xs uppercase tracking-wide text-muted">
          Linked claims
        </p>
        {linkedEdges.length === 0 && (
          <p className="text-xs text-muted">No linked claims yet.</p>
        )}
        <ul className="flex flex-col gap-2">
          {linkedEdges.map(({ edge, direction, other }) => (
            <li key={edge.id} className="text-xs leading-relaxed">
              <span className="text-muted">
                {direction} {EDGE_TYPE_LABEL[edge.type]}:
              </span>{" "}
              {other ? other.text : "(claim not loaded)"}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
