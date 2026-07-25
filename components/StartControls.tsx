type StartControlsProps = {
  isListening: boolean;
  supported: boolean;
  error: string | null;
  extractStatus?: "idle" | "pending" | "error";
  onStart: () => void;
  onStop: () => void;
};

function errorMessage(error: string): string {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission denied. Allow mic access and try again.";
    case "not-supported":
      return "Microphone recording isn't available in this browser.";
    default:
      if (error.length > 160) return `${error.slice(0, 160)}…`;
      return error;
  }
}

export function StartControls({
  isListening,
  supported,
  error,
  extractStatus = "idle",
  onStart,
  onStop,
}: StartControlsProps) {
  if (!supported) {
    return (
      <p className="text-sm text-danger">
        Needs a desktop browser with microphone + MediaRecorder (Chrome
        recommended). Gemini transcribes audio server-side.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <button
        type="button"
        onClick={isListening ? onStop : onStart}
        className={
          isListening
            ? "bg-danger px-5 py-2.5 font-display text-sm font-semibold text-white"
            : "bg-accent px-5 py-2.5 font-display text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
        }
      >
        {isListening ? "Stop session" : "Start listening"}
      </button>

      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-muted">
        <span
          aria-hidden
          className={`h-2 w-2 ${
            isListening ? "animate-pulse bg-accent" : "bg-border"
          }`}
        />
        {isListening ? "Listening" : "Standby"}
        {extractStatus === "pending" && (
          <span className="text-accent">· extracting</span>
        )}
      </div>

      {error && (
        <span
          className="max-w-md truncate text-sm text-danger"
          title={errorMessage(error)}
        >
          {errorMessage(error)}
        </span>
      )}
    </div>
  );
}
