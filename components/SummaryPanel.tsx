"use client";

import { useState } from "react";

import type {
  ApiErrorBody,
  Claim,
  Edge,
  SummaryResponse,
} from "@/lib/types/debate";

type SummaryPanelProps = {
  claims: Claim[];
  edges: Edge[];
};

export function SummaryPanel({ claims, edges }: SummaryPanelProps) {
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
        body: JSON.stringify({ claims, edges }),
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
    <div className="flex flex-col gap-3 border border-border bg-surface-elevated p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            Closing brief
          </p>
          <p className="font-display text-lg font-semibold tracking-tight">
            Debate summary
          </p>
        </div>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={loading || claims.length === 0}
          className="bg-ink-soft px-3 py-2 font-mono text-xs uppercase tracking-wide text-white transition-opacity disabled:opacity-40"
        >
          {loading ? "Working…" : "Generate"}
        </button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {!summary && !error && (
        <p className="text-sm text-muted">
          When the debate settles, generate a structural readout — counts,
          contested points, short narrative. No truth verdicts.
        </p>
      )}

      {summary && (
        <div className="space-y-3">
          <dl className="grid grid-cols-3 gap-2 font-mono text-xs">
            <div>
              <dt className="text-muted">Claims</dt>
              <dd className="text-lg text-foreground">{summary.claimCount}</dd>
            </div>
            <div>
              <dt className="text-muted">Evidence links</dt>
              <dd className="text-lg text-foreground">{summary.evidenceCount}</dd>
            </div>
            <div>
              <dt className="text-muted">Unsupported</dt>
              <dd className="text-lg text-foreground">
                {summary.unsupportedCount}
              </dd>
            </div>
          </dl>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Most contested
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              {summary.mostContestedClaimId
                ? (claims.find((c) => c.id === summary.mostContestedClaimId)
                    ?.text ?? "Contested claim unavailable")
                : "No clearly contested claim yet."}
            </p>
          </div>
          <p className="text-sm leading-relaxed text-ink-soft">
            {summary.narrative}
          </p>
        </div>
      )}
    </div>
  );
}
