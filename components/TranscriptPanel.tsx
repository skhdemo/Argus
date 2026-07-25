"use client";

import { useEffect, useRef } from "react";

import type { FinalChunk } from "@/hooks/useSpeechRecognition";

type TranscriptPanelProps = {
  chunks: FinalChunk[];
  interim: string;
};

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function speakerLabel(chunk: FinalChunk): string | null {
  if (!chunk.speaker || chunk.speaker === "UNKNOWN") return null;
  const hedged =
    chunk.speakerConfidence !== undefined && chunk.speakerConfidence < 0.55;
  return hedged ? `Speaker ${chunk.speaker}?` : `Speaker ${chunk.speaker}`;
}

export function TranscriptPanel({ chunks, interim }: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [chunks, interim]);

  const isEmpty = chunks.length === 0 && !interim;

  return (
    <div className="flex h-full min-h-[220px] flex-col overflow-hidden border border-border bg-surface-elevated">
      <div className="border-b border-border px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Live transcript
        </p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {isEmpty && (
          <p className="text-sm text-muted">
            The room is quiet. Press start and begin the debate.
          </p>
        )}
        {chunks.map((chunk, i) => {
          const label = speakerLabel(chunk);
          return (
            <p
              key={`${chunk.timestamp}-${i}`}
              className="text-sm leading-relaxed"
            >
              <span className="mr-2 font-mono text-[10px] text-muted">
                {formatTime(chunk.timestamp)}
              </span>
              {label && (
                <span
                  className={`mr-2 font-mono text-[10px] ${
                    chunk.speakerConfidence !== undefined &&
                    chunk.speakerConfidence < 0.55
                      ? "text-muted opacity-70"
                      : "text-accent"
                  }`}
                >
                  {label}
                </span>
              )}
              {chunk.text}
            </p>
          );
        })}
        {interim && (
          <p className="text-sm italic leading-relaxed text-muted">{interim}</p>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
