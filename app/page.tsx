"use client";

import { StartControls } from "@/components/StartControls";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

export default function Home() {
  const {
    isListening,
    start,
    stop,
    transcriptInterim,
    finalChunks,
    error,
    supported,
  } = useSpeechRecognition();

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

      <main className="flex flex-1 gap-4 overflow-hidden p-4">
        <section className="flex flex-1 items-center justify-center rounded-md border border-border bg-surface">
          <p className="font-mono text-sm text-muted">
            Waiting for first claim… (graph lands in B4.3)
          </p>
        </section>

        <aside className="flex w-96 flex-col gap-4">
          <div className="flex-1 overflow-hidden">
            <TranscriptPanel chunks={finalChunks} interim={transcriptInterim} />
          </div>
        </aside>
      </main>
    </div>
  );
}
