"use client";

import { useState } from "react";

import type {
  ApiErrorBody,
  Claim,
  Evidence,
  Relation,
  SummaryResponse,
} from "@/lib/types/debate";

type SummaryPanelProps = {
  claims: Claim[];
  evidence: Evidence[];
  relations: Relation[];
  speakerAName: string;
  speakerBName: string;
};

export function SummaryPanel({
  claims,
  evidence,
  relations,
  speakerAName,
  speakerBName,
}: SummaryPanelProps) {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claims, evidence, relations }),
      });
      if (!res.ok) {
        const body = (await res.json()) as ApiErrorBody;
        throw new Error(body.error || "Summary failed");
      }
      setSummary((await res.json()) as SummaryResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Summary failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex h-full flex-col border border-border bg-surface p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="readout">Closing brief</p>
          <p className="mt-1 font-display text-xl tracking-tight">Debate summary</p>
        </div>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={loading || claims.length === 0}
          className="bg-foreground px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--paper)] transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          {loading ? "Working…" : "Generate"}
        </button>
      </div>

      {error && (
        <div className="mt-5 border-l-2 border-danger bg-[var(--paper)]/45 px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <p className="mt-1 text-xs text-muted">
            The live flow is unaffected. You can generate the brief again.
          </p>
        </div>
      )}

      {!summary && !error && (
        <p className="mt-5 max-w-md text-sm leading-relaxed text-muted">
          When the debate settles, generate a structural readout — counts,
          source-check results, momentum score, and a short narrative.
        </p>
      )}

      {summary && (
        <div className="mt-6 space-y-6">
          <div className="border-y border-border py-4">
            <div className="flex items-end justify-between gap-4">
              <div className="text-left">
                <p className="readout truncate">{speakerAName}</p>
                <p className="mt-1 font-display text-3xl text-speaker-a">
                  {summary.debateScore.scoreA}
                </p>
              </div>
              <p className="readout pb-2 text-center">
                Structural score
                <span className="mt-1 block text-[9px] normal-case tracking-normal">
                  {summary.debateScore.leader === "tied"
                    ? "Even"
                    : `${summary.debateScore.leader === "A" ? speakerAName : speakerBName} leads`}
                </span>
              </p>
              <div className="text-right">
                <p className="readout truncate">{speakerBName}</p>
                <p className="mt-1 font-display text-3xl text-speaker-b">
                  {summary.debateScore.scoreB}
                </p>
              </div>
            </div>
            <div className="mt-3 flex h-1.5 overflow-hidden bg-paper-deep">
              <span
                className="bg-speaker-a"
                style={{ width: `${summary.debateScore.ratioA * 100}%` }}
              />
              <span className="flex-1 bg-speaker-b" />
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-x-4 gap-y-4 font-mono text-[10px] uppercase tracking-[0.08em] sm:grid-cols-4">
            {[
              ["Claims", summary.claimCount],
              ["Evidence", summary.evidenceCount],
              ["Unsupported", summary.unsupportedCount],
              ["Pending checks", summary.pendingEvidenceCount],
              ["Sources aligned", summary.corroboratedEvidenceCount],
              ["Contested", summary.contestedEvidenceCount],
              ["Inconclusive", summary.inconclusiveEvidenceCount],
              ["Not verifiable", summary.notVerifiableEvidenceCount],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="leading-tight text-muted">{label}</dt>
                <dd className="mt-1 text-xl text-foreground">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="border-t border-border pt-4">
            <p className="readout">Most contested</p>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              {summary.mostContestedClaimId
                ? (claims.find((c) => c.id === summary.mostContestedClaimId)
                    ?.text ?? "Contested claim unavailable")
                : "No clearly contested claim yet."}
            </p>
          </div>
          <p className="border-l border-rule pl-4 text-sm leading-relaxed text-foreground">
            {summary.narrative}
          </p>
        </div>
      )}
    </section>
  );
}
