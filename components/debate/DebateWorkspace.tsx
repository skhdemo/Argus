"use client";

import { useState } from "react";

import { ClaimInspector } from "@/components/ClaimInspector";
import { DebateGraph } from "@/components/DebateGraph";
import { MomentumBackdrop } from "@/components/MomentumBackdrop";
import { SummaryPanel } from "@/components/SummaryPanel";
import { useDebateSession } from "@/hooks/useDebateSession";
import { useEvidenceVerification } from "@/hooks/useEvidenceVerification";
import { useExtractionLoop } from "@/hooks/useExtractionLoop";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import type { SpeakerId } from "@/lib/types/debate";

export function DebateWorkspace() {
  const speech = useSpeechRecognition();
  const session = useDebateSession();
  const [topic, setTopic] = useState("");
  const [speakerAName, setSpeakerAName] = useState("Speaker A");
  const [speakerBName, setSpeakerBName] = useState("Speaker B");
  /** Fallback if diarization hasn't spoken yet — extract may still label speakers. */
  const [extractSpeaker, setExtractSpeaker] = useState<SpeakerId | null>(null);

  const speakerHint = speech.lastSpeaker ?? extractSpeaker;

  const verification = useEvidenceVerification({
    evidence: session.evidence,
    claims: session.claims,
    updateEvidenceVerification: session.updateEvidenceVerification,
  });

  const extraction = useExtractionLoop({
    isListening: speech.isListening,
    transcriptFinal: speech.transcriptFinal,
    existingClaims: session.claims,
    existingEvidence: session.evidence,
    existingRelations: session.relations,
    inferredSpeaker: speakerHint,
    onDelta: (delta) => {
      session.mergeExtractResponse(delta);
      if (delta.inferredSpeaker && delta.inferredSpeaker !== "UNKNOWN") {
        setExtractSpeaker(delta.inferredSpeaker);
      }
    },
  });

  const status = speech.isListening
    ? extraction.status === "pending"
      ? "Listening · reading the argument"
      : "Listening"
    : "Ready";
  const selectedEvidence = session.selectedClaimId
    ? [...(session.evidenceByClaimId.get(session.selectedClaimId) ?? [])]
    : [];
  const selectedRelations = session.selectedClaimId
    ? [...(session.relationsByClaimId.get(session.selectedClaimId) ?? [])]
    : [];

  return (
    <section
      id="debate"
      className="min-h-[100svh] border-t border-rule px-6 py-12 md:px-12 md:py-16"
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex items-baseline justify-between border-b border-rule pb-3">
          <span className="readout">The motion</span>
          <span className="readout flex items-center gap-2">
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${speech.isListening ? "animate-pulse" : ""}`}
              style={{
                background: speech.isListening
                  ? "var(--claim-supported)"
                  : "var(--faint)",
              }}
            />
            {status}
          </span>
        </div>

        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="What are they arguing about?"
          aria-label="Debate motion"
          className="mt-6 w-full bg-transparent text-center font-display text-[clamp(1.75rem,4vw,2.75rem)] leading-tight tracking-[-0.015em] text-foreground outline-none placeholder:text-faint"
        />

        <div className="mt-8 flex flex-col items-center gap-3 border-t border-rule pt-7">
          {speech.supported ? (
            <button
              type="button"
              onClick={speech.isListening ? speech.stop : speech.start}
              className={`px-8 py-3 text-sm font-medium transition-opacity hover:opacity-85 ${
                speech.isListening
                  ? "bg-danger text-white"
                  : "bg-foreground text-[var(--paper)]"
              }`}
            >
              {speech.isListening ? "Close the floor" : "Open the floor"}
            </button>
          ) : (
            <p className="max-w-xs text-center text-[13px] leading-relaxed text-danger">
              This browser can&rsquo;t record audio. Open Argus in desktop Chrome
              and allow the microphone.
            </p>
          )}
          <p className="readout">Click either name to rename a speaker</p>
        </div>

        {(speech.error && !speech.isListening) || extraction.errorMessage ? (
          <div className="mt-6 flex items-start justify-center gap-3 border-l-2 border-danger bg-surface px-4 py-3">
            <p className="text-[13px] leading-relaxed text-foreground">
              {speech.error && !speech.isListening
                ? speech.error
                : extraction.errorMessage}
            </p>
            {extraction.errorMessage && (
              <button
                type="button"
                onClick={extraction.dismissError}
                className="readout shrink-0 underline underline-offset-2 hover:text-foreground"
              >
                Dismiss
              </button>
            )}
          </div>
        ) : null}

        <div className="mt-16">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="readout">Live flow sheet</p>
            <p className="readout">
              {session.claims.length} claim
              {session.claims.length === 1 ? "" : "s"} ·{" "}
              {session.evidence.length} evidence
            </p>
          </div>
          <MomentumBackdrop
            momentum={session.momentum}
            speakerAName={speakerAName}
            speakerBName={speakerBName}
          >
            <DebateGraph
              claims={session.claims}
              evidence={session.evidence}
              relations={session.relations}
              selectedClaimId={session.selectedClaimId}
              onSelectClaim={session.selectClaim}
              speakerAName={speakerAName}
              speakerBName={speakerBName}
              onRenameA={setSpeakerAName}
              onRenameB={setSpeakerBName}
            />
          </MomentumBackdrop>
        </div>

        <div className="mt-8 grid items-stretch gap-8 pb-20 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]">
          <ClaimInspector
            claim={session.selectedClaim}
            evidence={selectedEvidence}
            relations={selectedRelations}
            claimsById={session.claimById}
            queueState={verification.queueState}
            onRetry={verification.retry}
            onSelectClaim={session.selectClaim}
            onClose={() => session.selectClaim(null)}
          />
          <SummaryPanel
            claims={session.claims}
            evidence={session.evidence}
            relations={session.relations}
            speakerAName={speakerAName}
            speakerBName={speakerBName}
          />
        </div>
      </div>
    </section>
  );
}
