/**
 * `useTranscription` — React hook that drives the local ASR pipeline.
 *
 *   const { run, state, progress, error, reset } = useTranscription();
 *   await run("/path/to/video.mp4");
 *
 * The state machine has four states:
 *   - `idle`      — nothing has been requested yet
 *   - `running`   — model is loaded, audio is being decoded (progress > 0)
 *   - `succeeded` — a `Transcription` is available
 *   - `failed`    — something went wrong; `error` is set
 *
 * The actual heavy lifting (ffmpeg extract, Parakeet inference, silence
 * classification) lives in the Rust backend — this hook just calls
 * `transcribeVideo` and re-shapes its events into a stable React state
 * machine. The contract here is the public API; the implementation can
 * change (and already did, from a placeholder mock to the real pipeline)
 * without touching the editor surface.
 */
import { useCallback, useMemo, useState } from "react";
import { transcribeVideo, type TranscribeProgress } from "./transcribe";
import type { Transcription } from "./types";

type RunState =
  | { kind: "idle" }
  | { kind: "running"; progress: TranscribeProgress | null }
  | { kind: "succeeded"; transcription: Transcription }
  | { kind: "failed"; error: string };

export function useTranscription() {
  const [state, setState] = useState<RunState>({ kind: "idle" });
  // `logs` is exposed so the editor surface can show a small console if it
  // wants to. We keep the last 50 lines to bound memory.
  const [logs, setLogs] = useState<string[]>([]);

  const reset = useCallback(() => {
    setState({ kind: "idle" });
    setLogs([]);
  }, []);

  const run = useCallback(async (path: string): Promise<Transcription> => {
    setState({ kind: "running", progress: null });
    setLogs([]);
    try {
      const transcription = await transcribeVideo(path, (event) => {
        if (event.kind === "log") {
          setLogs((prev) =>
            prev.length >= 50
              ? [...prev.slice(-49), event.line]
              : [...prev, event.line],
          );
        } else {
          setState((prev) =>
            prev.kind === "running"
              ? { kind: "running", progress: event.progress }
              : prev,
          );
          if (event.progress.stage === "done") {
            setState({
              kind: "succeeded",
              transcription: event.progress.transcription,
            });
          }
        }
      });
      // Defensive: the mock also resolves with the transcription. Make
      // sure the final state agrees with what the caller sees.
      setState({ kind: "succeeded", transcription });
      return transcription;
    } catch (err) {
      // Tauri 2's `invoke` can reject with several shapes depending on
      // what the Rust side returned: a plain `string` (from
      // `Result<_, String>`), an `Error` whose message is the Rust string,
      // or a wrapped `IpcResponse` object. Normalise to a readable string
      // and also dump to the dev console so the user can copy-paste it
      // when the on-screen card truncates.
      const message = describeError(err);
      // eslint-disable-next-line no-console
      console.error("[transcription] failed:", err);
      setState({ kind: "failed", error: message });
      throw err;
    }
  }, []);

  return useMemo(
    () => ({
      run,
      reset,
      state,
      logs,
    }),
    [run, reset, state, logs],
  );
}

/**
 * Best-effort stringification of whatever `invoke()` rejected with.
 *
 * Tauri 2 surfaces Rust `Err(String)` as an `Error` whose `.message` is
 * the original string, but we've also seen it come through as a bare
 * string (when the payload is an `IpcResponse` wrapper) and as an
 * `Error` with a generic message and a `.stack` containing the real
 * reason. Try them in order, fall back to `JSON.stringify`, then to a
 * vague "unknown" so the user always sees *something* on screen.
 */
function describeError(err: unknown): string {
  if (err == null) return "Unknown transcription error";
  if (err instanceof Error) {
    // The Rust error string often lives in the message itself, but on
    // some Tauri versions it ends up only in the stack. Concatenate so
    // we don't lose it.
    if (err.message && err.message !== err.stack) {
      return err.stack && err.message.length < 80
        ? `${err.message}\n${err.stack}`
        : err.message;
    }
    return err.message || err.stack || String(err);
  }
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const e = err as { message?: unknown; error?: unknown };
    if (typeof e.message === "string" && e.message) return e.message;
    if (typeof e.error === "string" && e.error) return e.error;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}
