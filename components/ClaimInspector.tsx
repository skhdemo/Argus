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

type ClaimInspectorProps = {
  claim: Claim | null;
  evidence: Evidence[];
  relations: Relation[];
  claimsById: ReadonlyMap<string, Claim>;
  queueState: EvidenceVerificationQueueState;
  onRetry: (evidenceId: string) => void;
  onSelectClaim: (claimId: string) => void;
  onClose: () => void;
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

export function ClaimInspector({
  claim,
  evidence,
  relations,
  claimsById,
  queueState,
  onRetry,
  onSelectClaim,
  onClose,
}: ClaimInspectorProps) {
  if (!claim) {
    return (
      <div className="flex min-h-72 flex-col justify-center border border-border bg-surface p-6">
        <p className="readout">Claim desk</p>
        <p className="mt-2 font-display text-xl tracking-tight">Select a claim</p>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
          Choose a card on either speaker rail to inspect its evidence, source
          checks, fallacy flags, and responses.
        </p>
      </div>
    );
  }

  const displayStatus = deriveClaimDisplayStatus(claim.id, evidence);
  const statusColor = CLAIM_STATUS_COLOR[displayStatus];
  const linkedRelations = relations
    .filter(
      (relation) =>
        relation.from === claim.id || relation.to === claim.id,
    )
    .map((relation) => {
      const outgoing = relation.from === claim.id;
      const otherId = outgoing ? relation.to : relation.from;
      return { relation, outgoing, other: claimsById.get(otherId) };
    });

  return (
    <section className="flex h-full flex-col border border-border bg-surface">
      <div className="border-b border-border p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="readout">Claim desk · {claim.id}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SpeakerLabel
                speaker={claim.speaker}
                confidence={claim.speakerConfidence}
              />
              <span className="border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted">
                {CLAIM_NATURE_LABEL[claim.nature]}
              </span>
              <span
                className="border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide"
                style={{ color: statusColor, borderColor: statusColor }}
              >
                {CLAIM_STATUS_LABEL[displayStatus]}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close claim inspector"
            className="readout transition-colors hover:text-foreground"
          >
            Close
          </button>
        </div>
        <p className="mt-5 text-base leading-relaxed text-foreground">
          {claim.text}
        </p>
        {claim.sourceExcerpt && (
          <blockquote className="mt-4 border-l border-rule pl-3 text-sm italic leading-relaxed text-muted">
            “{claim.sourceExcerpt}”
          </blockquote>
        )}
        <div className="mt-4">
          <FallacyBadge tags={claim.fallacies} />
        </div>
      </div>

      <div className="grid flex-1 gap-0 lg:grid-cols-[1.35fr_.85fr]">
        <div className="border-b border-border p-5 lg:border-b-0 lg:border-r md:p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="readout">Attached evidence</p>
              <p className="mt-1 font-display text-lg">
                {evidence.length} item{evidence.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {evidence.length === 0 ? (
            <p className="mt-5 text-sm leading-relaxed text-muted">
              No speaker-provided evidence is attached to this claim yet.
            </p>
          ) : (
            <ol className="mt-5 space-y-4">
              {evidence.map((item, index) => {
                const queue = queueState[item.id];
                return (
                  <li
                    key={item.id}
                    className="border-l-2 border-border bg-[var(--paper)]/45 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="readout tabular-nums">
                        EV {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                        {item.kind.replaceAll("_", " ")}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                        {RELEVANCE_LABEL[item.verification.relevance]}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-foreground">
                      {item.text}
                    </p>
                    <div className="mt-3 border-t border-border pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
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
                        <p className="mt-2 text-[13px] leading-relaxed text-muted">
                          {item.verification.summary}
                        </p>
                      )}
                      {item.verification.sources.length > 0 && (
                        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
                          {item.verification.sources.map((source, sourceIndex) => {
                            const href = safeExternalHref(source.uri);
                            const label =
                              source.title || source.domain || `Source ${sourceIndex + 1}`;
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
                        <div className="mt-3 flex items-start justify-between gap-3 border-t border-border pt-3">
                          <p className="text-xs leading-relaxed text-danger">
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
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="p-5 md:p-6">
          <p className="readout">Claim links</p>
          {linkedRelations.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No linked claims yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {linkedRelations.map(({ relation, outgoing, other }) => (
                <li key={relation.id}>
                  <button
                    type="button"
                    onClick={() => other && onSelectClaim(other.id)}
                    disabled={!other}
                    className="w-full border-l-2 border-rule py-1 pl-3 text-left transition-colors hover:border-foreground disabled:opacity-60"
                  >
                    <span className="readout block">
                      {outgoing ? "Outgoing" : "Incoming"} ·{" "}
                      {RELATION_LABEL[relation.type]}
                    </span>
                    <span className="mt-1 block text-[13px] leading-relaxed text-foreground">
                      {other?.text ?? "Linked claim unavailable"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
