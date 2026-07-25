type StartControlsProps = {
  isListening: boolean;
  supported: boolean;
  error: string | null;
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
      return `Speech capture error: ${error}`;
  }
}

export function StartControls({
  isListening,
  supported,
  error,
  onStart,
  onStop,
}: StartControlsProps) {
  if (!supported) {
    return (
      <div className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-danger">
        Speech capture needs a desktop browser with microphone +{" "}
        <strong className="text-foreground">MediaRecorder</strong> (Chrome
        recommended). Gemini transcribes audio server-side.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={isListening ? onStop : onStart}
        className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium transition-colors hover:border-accent"
      >
        {isListening ? "Stop" : "Start"}
      </button>

      <div className="flex items-center gap-2 text-sm text-muted">
        <span
          aria-hidden
          className={`h-2 w-2 rounded-full ${
            isListening ? "animate-pulse bg-accent" : "bg-border"
          }`}
        />
        {isListening ? "Listening (Gemini STT)" : "Not listening"}
      </div>

      {error && !isListening && (
        <span className="text-sm text-danger">{errorMessage(error)}</span>
      )}
    </div>
  );
}
