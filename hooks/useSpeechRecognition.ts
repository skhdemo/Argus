"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/**
 * Web Speech API types aren't in lib.dom.d.ts. Minimal ambient shape for the
 * handful of members this hook actually touches.
 */
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export type FinalChunk = {
  text: string;
  timestamp: number;
};

export type UseSpeechRecognitionResult = {
  isListening: boolean;
  start: () => void;
  stop: () => void;
  /** Full accumulated final transcript, space-joined. */
  transcriptFinal: string;
  /** Current in-progress (not yet final) utterance. */
  transcriptInterim: string;
  /** Final transcript as discrete timestamped chunks, for TranscriptPanel. */
  finalChunks: FinalChunk[];
  error: string | null;
  supported: boolean;
};

function getRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

// Browser support never changes after mount, so no real subscription is needed.
function subscribeNoop() {
  return () => {};
}
function getSupportedSnapshot() {
  return getRecognitionCtor() !== null;
}
function getServerSupportedSnapshot() {
  return false;
}

// Chrome fires "no-speech" routinely during normal pauses — not a real error.
const IGNORABLE_ERRORS = new Set(["no-speech", "aborted"]);

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false);
  const [transcriptFinal, setTranscriptFinal] = useState("");
  const [transcriptInterim, setTranscriptInterim] = useState("");
  const [finalChunks, setFinalChunks] = useState<FinalChunk[]>([]);
  const [error, setError] = useState<string | null>(null);

  // window doesn't exist during SSR, so this can't be computed synchronously
  // without a hydration mismatch — useSyncExternalStore forces the server
  // snapshot (false) on first client render, then resolves after mount.
  const supported = useSyncExternalStore(
    subscribeNoop,
    getSupportedSnapshot,
    getServerSupportedSnapshot,
  );

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Tracks intent (as opposed to isListening state, which lags a tick behind
  // onend) so the restart-on-end handler knows whether to actually restart.
  const activeRef = useRef(false);

  const ensureRecognition = useCallback((): SpeechRecognitionLike | null => {
    if (recognitionRef.current) return recognitionRef.current;

    const Ctor = getRecognitionCtor();
    if (!Ctor) return null;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          const chunk = text.trim();
          if (chunk) {
            setTranscriptFinal((prev) => (prev ? `${prev} ${chunk}` : chunk));
            setFinalChunks((prev) => [
              ...prev,
              { text: chunk, timestamp: Date.now() },
            ]);
          }
        } else {
          interim += text;
        }
      }
      setTranscriptInterim(interim);
    };

    recognition.onerror = (event) => {
      if (IGNORABLE_ERRORS.has(event.error)) return;

      setError(event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        activeRef.current = false;
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      if (activeRef.current) {
        // Chrome silently ends recognition after a pause even with
        // continuous=true — restart to keep the session alive.
        try {
          recognition.start();
        } catch {
          // Already starting/started; ignore.
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    return recognition;
  }, []);

  const start = useCallback(() => {
    const recognition = ensureRecognition();
    if (!recognition) {
      setError("not-supported");
      return;
    }
    setError(null);
    activeRef.current = true;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      // start() throws if already started; state is already correct.
    }
  }, [ensureRecognition]);

  const stop = useCallback(() => {
    activeRef.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
    setTranscriptInterim("");
  }, []);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  return {
    isListening,
    start,
    stop,
    transcriptFinal,
    transcriptInterim,
    finalChunks,
    error,
    supported,
  };
}
