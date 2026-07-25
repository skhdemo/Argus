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
      className="min-h-[100svh] border-t border-border bg-background px-4 py-10 md:px-10"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center">
        <div className="mb-8 flex w-full flex-col items-center gap-5">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Debate topic"
            className="w-full max-w-md border-b border-line bg-transparent px-2 py-2 text-center font-display text-2xl tracking-tight outline-none placeholder:text-muted md:text-3xl"
          />

          <div className="flex flex-wrap items-center justify-center gap-3">
            <input
              value={speakerAName}
              onChange={(e) => setSpeakerAName(e.target.value)}
              aria-label="Rename speaker A"
              className="w-36 border border-border bg-surface px-2 py-1.5 text-center text-sm outline-none focus:border-speaker-a"
            />
            <input
              value={speakerBName}
              onChange={(e) => setSpeakerBName(e.target.value)}
              aria-label="Rename speaker B"
              className="w-36 border border-border bg-surface px-2 py-1.5 text-center text-sm outline-none focus:border-speaker-b"
            />
          </div>

          <div className="flex flex-col items-center gap-2">
            {!speech.supported ? (
              <p className="text-sm text-danger">Needs desktop Chrome + mic.</p>
            ) : (
              <button
                type="button"
                onClick={speech.isListening ? speech.stop : speech.start}
                className="border border-line bg-foreground px-8 py-2.5 text-sm font-medium text-background"
              >
                {speech.isListening ? "Stop" : "Start"}
              </button>
            )}
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
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

        {/* Full-width graph; grows downward — page scrolls with the branches */}
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
