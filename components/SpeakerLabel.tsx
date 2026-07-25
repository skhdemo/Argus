import type { SpeakerId } from "@/lib/types/debate";

type SpeakerLabelProps = {
  speaker: SpeakerId;
  confidence?: number;
  className?: string;
};

export function SpeakerLabel({
  speaker,
  confidence = 1,
  className = "",
}: SpeakerLabelProps) {
  if (speaker === "UNKNOWN") {
    return (
      <span className={`font-mono text-xs text-muted ${className}`}>
        Unknown speaker
      </span>
    );
  }

  const hedged = confidence < 0.55;
  const color = speaker === "A" ? "var(--speaker-a)" : "var(--speaker-b)";

  return (
    <span
      className={`font-mono text-xs ${hedged ? "opacity-55" : "opacity-100"} ${className}`}
      style={{ color }}
    >
      Speaker {speaker}
      {hedged ? "?" : ""}
    </span>
  );
}
