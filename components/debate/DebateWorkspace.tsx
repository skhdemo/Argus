"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";

import { ClaimInspector } from "@/components/ClaimInspector";
import { DebateGraph } from "@/components/DebateGraph";
import { MomentumBackdrop } from "@/components/MomentumBackdrop";
import { StartControls } from "@/components/StartControls";
import { SummaryPanel } from "@/components/SummaryPanel";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { useDebateSession } from "@/hooks/useDebateSession";
import { useExtractionLoop } from "@/hooks/useExtractionLoop";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import type { SpeakerId } from "@/lib/types/debate";

export function DebateWorkspace() {
  const speech = useSpeechRecognition();
  const session = useDebateSession();
  const [lastSpeaker, setLastSpeaker] = useState<SpeakerId | null>(null);

  const extraction = useExtractionLoop({
    isListening: speech.isListening,
    transcriptFinal: speech.transcriptFinal,
    existingClaims: session.claims,
    existingEdges: session.edges,
    inferredSpeaker: lastSpeaker,
    onDelta: (delta) => {
      session.mergeExtractResponse(delta);
      if (delta.inferredSpeaker && delta.inferredSpeaker !== "UNKNOWN") {
        setLastSpeaker(delta.inferredSpeaker);
      }
    },
  });

  const claimsById = useMemo(
    () => new Map(session.claims.map((c) => [c.id, c])),
    [session.claims],
  );

  const selectedClaim = session.selectedClaimId
    ? (claimsById.get(session.selectedClaimId) ?? null)
    : null;

  return (
    <section
      id="debate"
      className="min-h-[100svh] scroll-mt-0 bg-background px-4 py-10 md:px-8 lg:px-12"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto flex max-w-[1400px] flex-col gap-6"
      >
        <header className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Debate floor
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Live reasoning map
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted md:text-base">
              Start the mic. Talk naturally. The graph updates as Argus extracts
              structure in the background.
            </p>
          </div>
          <StartControls
            isListening={speech.isListening}
            supported={speech.supported}
            error={speech.error}
            extractStatus={extraction.status}
            onStart={speech.start}
            onStop={speech.stop}
          />
        </header>

        {extraction.errorMessage && (
          <div className="flex items-center justify-between gap-3 border border-danger/30 bg-surface-elevated px-4 py-3 text-sm text-danger">
            <span>{extraction.errorMessage}</span>
            <button
              type="button"
              onClick={extraction.dismissError}
              className="font-mono text-xs uppercase tracking-wide"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
          <MomentumBackdrop momentum={session.momentum}>
            <DebateGraph
              claims={session.claims}
              edges={session.edges}
              selectedClaimId={session.selectedClaimId}
              onSelectClaim={session.selectClaim}
            />
          </MomentumBackdrop>

          <aside className="flex min-h-[420px] flex-col gap-4">
            <div className="min-h-[200px] flex-1">
              <ClaimInspector
                claim={selectedClaim}
                edges={session.edges}
                claimsById={claimsById}
                onClose={() => session.selectClaim(null)}
              />
            </div>
            <SummaryPanel claims={session.claims} edges={session.edges} />
          </aside>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <TranscriptPanel
            chunks={speech.finalChunks}
            interim={speech.transcriptInterim}
          />
          {process.env.NODE_ENV === "development" && (
            <div className="flex flex-col gap-2 border border-dashed border-border p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                Dev fixtures
              </p>
              {(
                ["claim-only", "support-edge", "contradict-edge"] as const
              ).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => extraction.injectFixture(name)}
                  className="border border-border bg-surface-elevated px-3 py-2 text-left font-mono text-xs hover:border-accent"
                >
                  Inject {name}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </section>
  );
}
