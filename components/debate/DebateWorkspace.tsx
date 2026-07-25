"use client";

import { useState } from "react";

import { DebateGraph } from "@/components/DebateGraph";
import { useDebateSession } from "@/hooks/useDebateSession";
import { useExtractionLoop } from "@/hooks/useExtractionLoop";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import type { SpeakerId } from "@/lib/types/debate";

export function DebateWorkspace() {
  const speech = useSpeechRecognition();
  const session = useDebateSession();
  const [topic, setTopic] = useState("");
  const [speakerAName, setSpeakerAName] = useState("Speaker A");
  const [speakerBName, setSpeakerBName] = useState("Speaker B");
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

  return (
    <section
      id="debate"
      className="min-h-[100svh] border-t border-border/80 px-4 py-12 md:px-10"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center">
        <div className="mb-10 flex w-full flex-col items-center gap-5">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Debate topic"
            className="w-full max-w-lg rounded-soft border border-transparent bg-surface/70 px-4 py-3 text-center font-display text-2xl font-semibold tracking-tight text-foreground outline-none ring-1 ring-border placeholder:text-muted focus:ring-2 focus:ring-accent md:text-3xl"
          />

          <div className="flex flex-wrap items-center justify-center gap-3">
            <input
              value={speakerAName}
              onChange={(e) => setSpeakerAName(e.target.value)}
              aria-label="Rename speaker A"
              className="w-40 rounded-soft border border-border bg-surface px-3 py-2 text-center text-sm font-medium outline-none focus:border-speaker-a"
            />
            <input
              value={speakerBName}
              onChange={(e) => setSpeakerBName(e.target.value)}
              aria-label="Rename speaker B"
              className="w-40 rounded-soft border border-border bg-surface px-3 py-2 text-center text-sm font-medium outline-none focus:border-speaker-b"
            />
          </div>

          <div className="flex flex-col items-center gap-2">
            {!speech.supported ? (
              <p className="text-sm text-danger">Needs desktop Chrome + mic.</p>
            ) : (
              <button
                type="button"
                onClick={speech.isListening ? speech.stop : speech.start}
                className={
                  speech.isListening
                    ? "rounded-soft bg-danger px-8 py-2.5 text-sm font-semibold text-white"
                    : "rounded-soft bg-accent px-8 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                }
              >
                {speech.isListening ? "Stop" : "Start"}
              </button>
            )}
            <p className="text-xs font-medium tracking-wide text-muted">
              {speech.isListening
                ? extraction.status === "pending"
                  ? "Listening · extracting"
                  : "Listening"
                : "Ready"}
            </p>
            {speech.error && !speech.isListening && (
              <p className="text-sm text-danger">{speech.error}</p>
            )}
            {extraction.errorMessage && (
              <button
                type="button"
                onClick={extraction.dismissError}
                className="text-sm text-danger underline"
              >
                {extraction.errorMessage} · dismiss
              </button>
            )}
          </div>
        </div>

        <div className="w-full">
          <DebateGraph
            claims={session.claims}
            edges={session.edges}
            speakerAName={speakerAName.trim() || "Speaker A"}
            speakerBName={speakerBName.trim() || "Speaker B"}
          />
        </div>
      </div>
    </section>
  );
}
