"use client";

import { useCallback, useState } from "react";

import { ClaimInspector } from "@/components/ClaimInspector";
import { DebateGraph } from "@/components/DebateGraph";
import { MomentumBackdrop } from "@/components/MomentumBackdrop";
import { StartControls } from "@/components/StartControls";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { useDebateSession } from "@/hooks/useDebateSession";
import {
  useExtractionLoop,
  type FixtureName,
} from "@/hooks/useExtractionLoop";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import type { ExtractResponse, SpeakerId } from "@/lib/types/debate";

const FIXTURE_ORDER: FixtureName[] = ["claim-only", "support-edge", "contradict-edge"];

function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-danger/40 bg-danger/10 px-6 py-2 text-sm text-danger">
      <span>{message}</span>
      <button type="button" onClick={onDismiss} className="hover:text-foreground">
        Dismiss
      </button>
    </div>
  );
}

function DevFixtureBar({ onInject }: { onInject: (name: FixtureName) => void }) {
  return (
    <div className="flex items-center gap-2 border-t border-border bg-surface px-6 py-2">
      <span className="font-mono text-xs text-muted">Dev: inject fixture</span>
      {FIXTURE_ORDER.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onInject(name)}
          className="rounded border border-border px-2 py-1 font-mono text-xs transition-colors hover:border-accent"
        >
          {name}
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const {
    isListening,
    start,
    stop,
    transcriptFinal,
    transcriptInterim,
    finalChunks,
    lastSpeaker,
    error,
    supported,
  } = useSpeechRecognition();

  const session = useDebateSession();
  const [lastInferredSpeaker, setLastInferredSpeaker] = useState<SpeakerId | null>(null);

  const handleDelta = useCallback(
    (delta: ExtractResponse) => {
      session.mergeExtractResponse(delta);
      setLastInferredSpeaker(delta.inferredSpeaker);
    },
    [session],
  );

  const speakerHint = lastSpeaker ?? lastInferredSpeaker;

  const loop = useExtractionLoop({
    isListening,
    transcriptFinal,
    existingClaims: session.claims,
    existingEdges: session.edges,
    inferredSpeaker: speakerHint,
    onDelta: handleDelta,
  });

  const selectedClaim =
    session.claims.find((c) => c.id === session.selectedClaimId) ?? null;
  const claimsById = new Map(session.claims.map((c) => [c.id, c]));

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="font-mono text-lg font-semibold tracking-tight">
          Argus
        </h1>
        <StartControls
          isListening={isListening}
          supported={supported}
          error={error}
          onStart={start}
          onStop={stop}
        />
      </header>

      {loop.errorMessage && (
        <ErrorBanner message={loop.errorMessage} onDismiss={loop.dismissError} />
      )}

      <main className="flex flex-1 gap-4 overflow-hidden p-4">
        <MomentumBackdrop momentum={session.momentum}>
          <DebateGraph
            claims={session.claims}
            edges={session.edges}
            selectedClaimId={session.selectedClaimId}
            onSelectClaim={session.selectClaim}
          />
        </MomentumBackdrop>

        <aside className="flex w-96 flex-col gap-4 overflow-hidden">
          {selectedClaim && (
            <ClaimInspector
              claim={selectedClaim}
              edges={session.edges}
              claimsById={claimsById}
              onClose={() => session.selectClaim(null)}
            />
          )}
          <div className="flex-1 overflow-hidden">
            <TranscriptPanel chunks={finalChunks} interim={transcriptInterim} />
          </div>
        </aside>
      </main>

      {process.env.NODE_ENV !== "production" && (
        <DevFixtureBar onInject={loop.injectFixture} />
      )}
    </div>
  );
}
