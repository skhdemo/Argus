import { FallacyBadge } from "@/components/FallacyBadge";
import { SpeakerLabel } from "@/components/SpeakerLabel";
import {
  CLAIM_NATURE_LABEL,
  CLAIM_STATUS_COLOR,
  CLAIM_STATUS_LABEL,
  RELATION_LABEL,
  RELEVANCE_LABEL,
  VERIFICATION_STATUS_LABEL,
} from "@/components/debate/statusPresentation";
import type { EvidenceVerificationQueueState } from "@/hooks/useEvidenceVerification";
import { deriveClaimDisplayStatus } from "@/lib/debate/status";
import type { Claim, Evidence, Relation } from "@/lib/types/debate";

type ClaimHoverCardProps = {
  claim: Claim;
  evidence: Evidence[];
  relations: Relation[];
  claimsById: ReadonlyMap<string, Claim>;
  queueState: EvidenceVerificationQueueState;
  onRetry: (evidenceId: string) => void;
};

const QUEUE_LABEL = {
  queued: "Queued",
  verifying: "Checking sources",
  retrying: "Retrying source check",
  complete: "Source check complete",
  error: "Source check paused",
} as const;

function safeExternalHref(uri: string): string | null {
  try {
    const url = new URL(uri);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/** Claim detail on demand: the only surface that shows evidence and sources. */
export function ClaimHoverCard({
  claim,
  evidence,
  relations,
  claimsById,
  queueState,
  onRetry,
}: ClaimHoverCardProps) {
  const displayStatus = deriveClaimDisplayStatus(claim.id, evidence);
  const statusColor = CLAIM_STATUS_COLOR[displayStatus];
  const linked = relations.map((relation) => {
    const outgoing = relation.from === claim.id;
    const otherId = outgoing ? relation.to : relation.from;
    return { relation, outgoing, other: claimsById.get(otherId) };
  });

  return (
    <div className="max-h-[58vh] overflow-y-auto border border-border bg-surface shadow-[0_18px_48px_rgba(22,25,27,0.16)]">
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <SpeakerLabel
            speaker={claim.speaker}
            confidence={claim.speakerConfidence}
          />
          <span className="border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-muted">
            {CLAIM_NATURE_LABEL[claim.nature]}
          </span>
          <span
            className="border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide"
            style={{ color: statusColor, borderColor: statusColor }}
          >
            {CLAIM_STATUS_LABEL[displayStatus]}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-foreground">
          {claim.text}
        </p>
        {claim.sourceExcerpt && (
          <blockquote className="mt-3 border-l border-rule pl-3 text-[13px] italic leading-relaxed text-muted">
            “{claim.sourceExcerpt}”
          </blockquote>
        )}
        {(claim.fallacies?.length ?? 0) > 0 && (
          <div className="mt-3">
            <FallacyBadge tags={claim.fallacies} />
          </div>
        )}
      </div>

      <div className="px-4 py-3">
        <p className="readout">
          Attached evidence · {evidence.length} item
          {evidence.length === 1 ? "" : "s"}
        </p>
        {evidence.length === 0 ? (
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            No speaker-provided evidence is attached to this claim yet.
          </p>
        ) : (
          <ol className="mt-3 space-y-3">
            {evidence.map((item, index) => {
              const queue = queueState[item.id];
              return (
                <li
                  key={item.id}
                  className="border-l-2 border-border bg-[var(--paper)]/45 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="readout tabular-nums">
                      EV {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                      {item.kind.replaceAll("_", " ")}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                      {RELEVANCE_LABEL[item.verification.relevance]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">
                    {item.text}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                    <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                      {VERIFICATION_STATUS_LABEL[item.verification.status]}
                    </span>
                    {queue && (
                      <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-faint">
                        {QUEUE_LABEL[queue.status]}
                        {queue.attempts > 0 ? ` · attempt ${queue.attempts}` : ""}
                      </span>
                    )}
                  </div>
                  {item.verification.summary && (
                    <p className="mt-2 text-[12px] leading-relaxed text-muted">
                      {item.verification.summary}
                    </p>
                  )}
                  {item.verification.sources.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
                      {item.verification.sources.map((source, sourceIndex) => {
                        const href = safeExternalHref(source.uri);
                        const label =
                          source.title ||
                          source.domain ||
                          `Source ${sourceIndex + 1}`;
                        return (
                          <li key={`${source.uri}-${sourceIndex}`}>
                            {href ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
                              >
                                {label} ↗
                              </a>
                            ) : (
                              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                                {label}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {queue?.status === "error" && (
                    <div className="mt-2 flex items-start justify-between gap-3 border-t border-border pt-2">
                      <p className="text-[12px] leading-relaxed text-danger">
                        {queue.error || "Source check paused."}
                      </p>
                      <button
                        type="button"
                        onClick={() => onRetry(item.id)}
                        className="readout shrink-0 border border-danger px-2 py-1 text-danger hover:bg-danger hover:text-white"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {linked.length > 0 && (
        <div className="border-t border-border px-4 py-3">
          <p className="readout">Claim links</p>
          <ul className="mt-2 space-y-2">
            {linked.map(({ relation, outgoing, other }) => (
              <li key={relation.id} className="border-l-2 border-rule pl-3">
                <span className="readout block">
                  {outgoing ? "Outgoing" : "Incoming"} ·{" "}
                  {RELATION_LABEL[relation.type]}
                </span>
                <span className="mt-1 block text-[12px] leading-relaxed text-foreground">
                  {other?.text ?? "Linked claim unavailable"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
