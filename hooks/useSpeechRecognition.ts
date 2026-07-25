"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type {
  ApiErrorBody,
  SpeakerId,
  TranscribeResponse,
} from "@/lib/types/debate";

/** How long each mic slice is before we send it to Gemini (~live cadence). */
const CHUNK_MS = 4000;

export type FinalChunk = {
  text: string;
  timestamp: number;
  speaker?: SpeakerId;
  speakerConfidence?: number;
};

export type UseSpeechRecognitionResult = {
  isListening: boolean;
  start: () => void;
  stop: () => void;
  /** Full accumulated final transcript, space-joined. */
  transcriptFinal: string;
  /**
   * Status line while a chunk is uploading / being transcribed
   * (replaces Web Speech interim results).
   */
  transcriptInterim: string;
  finalChunks: FinalChunk[];
  /** Latest speaker from Gemini diarization (for extract hints). */
  lastSpeaker: SpeakerId | null;
  error: string | null;
  /** True when getUserMedia + MediaRecorder are available. */
  supported: boolean;
};

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

function getClientSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}

function subscribeNoop() {
  return () => {};
}
function getServerSupportedSnapshot() {
  return false;
}

/**
 * Live speech capture via MediaRecorder → Gemini `/api/transcribe`
 * (STT + speaker diarization). Replaces the Web Speech API path.
 */
export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false);
  const [transcriptFinal, setTranscriptFinal] = useState("");
  const [transcriptInterim, setTranscriptInterim] = useState("");
  const [finalChunks, setFinalChunks] = useState<FinalChunk[]>([]);
  const [lastSpeaker, setLastSpeaker] = useState<SpeakerId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supported = useSyncExternalStore(
    subscribeNoop,
    getClientSupported,
    getServerSupportedSnapshot,
  );

  const activeRef = useRef(false);
  const wantStartRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const mimeRef = useRef<string | undefined>(undefined);
  const lastSpeakerRef = useRef<SpeakerId | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const chunkPartsRef = useRef<Blob[]>([]);

  const stopTracks = useCallback(() => {
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const transcribeBlob = useCallback(async (blob: Blob) => {
    if (blob.size < 256) return; // ignore near-empty slices

    setTranscriptInterim("Transcribing with Gemini…");
    const form = new FormData();
    form.append("audio", blob, `chunk.${blob.type.includes("mp4") ? "mp4" : "webm"}`);
    if (lastSpeakerRef.current) {
      form.append("lastSpeaker", lastSpeakerRef.current);
    }

    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const body = (await res.json()) as ApiErrorBody;
        setError(body.error || "Transcription failed");
        setTranscriptInterim("");
        return;
      }

      const data = (await res.json()) as TranscribeResponse;
      if (!data.segments.length && !data.text.trim()) {
        setTranscriptInterim("");
        return;
      }

      const now = Date.now();
      const newChunks: FinalChunk[] = data.segments.length
        ? data.segments.map((s) => ({
            text: s.text,
            timestamp: now,
            speaker: s.speaker,
            speakerConfidence: data.speakerConfidence,
          }))
        : [
            {
              text: data.text,
              timestamp: now,
              speaker: data.inferredSpeaker,
              speakerConfidence: data.speakerConfidence,
            },
          ];

      const appended = newChunks.map((c) => c.text).join(" ");
      setFinalChunks((prev) => [...prev, ...newChunks]);
      setTranscriptFinal((prev) => (prev ? `${prev} ${appended}` : appended));

      if (data.inferredSpeaker !== "UNKNOWN") {
        lastSpeakerRef.current = data.inferredSpeaker;
        setLastSpeaker(data.inferredSpeaker);
      } else if (newChunks.at(-1)?.speaker && newChunks.at(-1)!.speaker !== "UNKNOWN") {
        const sp = newChunks.at(-1)!.speaker!;
        lastSpeakerRef.current = sp;
        setLastSpeaker(sp);
      }

      setError(null);
      setTranscriptInterim("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription request failed");
      setTranscriptInterim("");
    }
  }, []);

  const enqueueTranscribe = useCallback(
    (blob: Blob) => {
      queueRef.current = queueRef.current
        .then(() => transcribeBlob(blob))
        .catch(() => {
          /* errors surfaced in state */
        });
    },
    [transcribeBlob],
  );

  const startRecorderLoop = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !activeRef.current) return;

    const mime = mimeRef.current;
    const recorder = mime
      ? new MediaRecorder(stream, { mimeType: mime })
      : new MediaRecorder(stream);
    recorderRef.current = recorder;
    chunkPartsRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunkPartsRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const parts = chunkPartsRef.current;
      chunkPartsRef.current = [];
      if (parts.length > 0) {
        const blob = new Blob(parts, {
          type: recorder.mimeType || mime || "audio/webm",
        });
        enqueueTranscribe(blob);
      }
      if (activeRef.current && streamRef.current) {
        startRecorderLoop();
      } else {
        stopTracks();
      }
    };

    recorder.onerror = () => {
      setError("MediaRecorder error");
      activeRef.current = false;
      setIsListening(false);
      stopTracks();
    };

    try {
      recorder.start();
      window.setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }, CHUNK_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start recorder");
      activeRef.current = false;
      setIsListening(false);
      stopTracks();
    }
  }, [enqueueTranscribe, stopTracks]);

  const start = useCallback(() => {
    if (!getClientSupported()) {
      setError("not-supported");
      return;
    }
    if (wantStartRef.current || activeRef.current) return;

    wantStartRef.current = true;
    setError(null);
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        if (!wantStartRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        mimeRef.current = pickMimeType();
        activeRef.current = true;
        setIsListening(true);
        setTranscriptInterim("Listening…");
        startRecorderLoop();
      } catch (err) {
        wantStartRef.current = false;
        const name = err instanceof Error ? err.name : "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setError("not-allowed");
        } else {
          setError(err instanceof Error ? err.message : "Microphone error");
        }
        activeRef.current = false;
        setIsListening(false);
        stopTracks();
      }
    })();
  }, [startRecorderLoop, stopTracks]);

  const stop = useCallback(() => {
    wantStartRef.current = false;
    activeRef.current = false;
    setIsListening(false);
    setTranscriptInterim("");
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      try {
        recorder.stop();
      } catch {
        stopTracks();
      }
    } else {
      stopTracks();
    }
  }, [stopTracks]);

  useEffect(() => {
    return () => {
      wantStartRef.current = false;
      activeRef.current = false;
      try {
        recorderRef.current?.stop();
      } catch {
        /* ignore */
      }
      stopTracks();
    };
  }, [stopTracks]);

  return {
    isListening,
    start,
    stop,
    transcriptFinal,
    transcriptInterim,
    finalChunks,
    lastSpeaker,
    error,
    supported,
  };
}
