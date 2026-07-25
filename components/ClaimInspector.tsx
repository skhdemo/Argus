import type { ReactNode } from "react";

import { FallacyBadge } from "@/components/FallacyBadge";
import { SpeakerLabel } from "@/components/SpeakerLabel";
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
  renderBadges?: (claim: Claim) => ReactNode;
};

export function ClaimInspector({
  claim,
  edges,
  claimsById,
  onClose,
  renderBadges,
}: ClaimInspectorProps) {
  if (!claim) {
    return (
      <div className="flex h-full flex-col justify-center border border-border bg-surface-elevated p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Inspector
        </p>
        <p className="mt-2 font-display text-lg font-semibold tracking-tight">
          Select a claim
        </p>
        <p className="mt-2 text-sm text-muted">
          Click a node in the map to read its text, speaker, and links.
        </p>
      </div>
    );
  }

  const linkedEdges = edges
    .filter((edge) => edge.from === claim.id || edge.to === claim.id)
    .map((edge) => {
      const otherId = edge.from === claim.id ? edge.to : edge.from;
      const direction = edge.from === claim.id ? "→" : "←";
      return { edge, direction, other: claimsById.get(otherId) };
    });

  return (
    <div className="flex h-full flex-col gap-4 border border-border bg-surface-elevated p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            Inspector
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <SpeakerLabel
              speaker={claim.speaker}
              confidence={claim.speakerConfidence}
            />
            <span
              className="border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide"
              style={{
                color: CLAIM_TYPE_COLOR_VAR[claim.type],
                borderColor: CLAIM_TYPE_COLOR_VAR[claim.type],
              }}
            >
              {CLAIM_TYPE_LABEL[claim.type]}
            </span>
          </div>
          {renderBadges ? (
            renderBadges(claim)
          ) : (
            <FallacyBadge
              tags={claim.fallacies}
              unsupported={claim.unsupported}
            />
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="font-mono text-xs text-muted transition-colors hover:text-foreground"
        >
          Close
        </button>
      </div>

      <p className="text-base leading-relaxed text-ink-soft">{claim.text}</p>

      <div className="border-t border-border pt-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Linked claims
        </p>
        {linkedEdges.length === 0 && (
          <p className="text-sm text-muted">No linked claims yet.</p>
        )}
        <ul className="flex flex-col gap-2">
          {linkedEdges.map(({ edge, direction, other }) => (
            <li key={edge.id} className="text-sm leading-relaxed">
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
