/**
 * `transcribeVideo` — runs the local ASR pipeline on a video file and
 * returns a fully-typed `Transcription`.
 *
 * The pipeline lives in the Tauri Rust backend (`src-tauri/src/transcription.rs`)
 * and uses the local `parakeet-tdt-0.6b-v3-int8` ONNX model via `parakeet-rs`.
 * See `docs/asr-model-decision.md` for the high-level "why Parakeet" and
 * `src-tauri/src/model_manager.rs` for the download / on-disk layout.
 *
 * This module is the thin TS shim: it calls the `transcribe_path` Tauri
 * command, subscribes to the `transcribe://progress` event stream, and
 * re-shapes the Rust payload into the `TranscribeEvent` contract the
 * React hook already consumes. No UI code needs to know we're talking
 * over the IPC bridge.
 *
 * Browser fallback: when the app is opened in a regular browser
 * (`bun run dev` without the Tauri shell) `invoke` is not available —
 * we surface a friendly error so the editor doesn't crash on
 * `transcribe_path is not a function`. The `isTauri` guard keeps the
 * rest of the UI (file picker, transcript mock layout) usable.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Transcription } from "./types";

/** Coarse progress events streamed while transcription runs. */
export type TranscribeProgress =
  | { stage: "preparing"; message: string }
  | { stage: "decoding"; message: string; ratio: number }
  | { stage: "inferring"; message: string; ratio: number }
  | { stage: "assembling"; message: string }
  | { stage: "done"; transcription: Transcription };

export type TranscribeEvent =
  | { kind: "progress"; progress: TranscribeProgress }
  | { kind: "log"; line: string };

export type ProgressListener = (event: TranscribeEvent) => void;

/**
 * True when running inside the Tauri desktop shell. We feature-detect the
 * `__TAURI_INTERNALS__` global that Tauri injects before any plugin script
 * loads. This is the same check the official plugins use.
 */
function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    // @ts-expect-error — the global is injected at runtime, not typed here.
    typeof window.__TAURI_INTERNALS__ !== "undefined"
  );
}

/**
 * Public entry point. Returns the final `Transcription` and also streams
 * events to `onEvent` (the hook uses this to drive a progress bar).
 *
 * Throws with a human-readable message if the ASR model has not been
 * downloaded yet, if `ffmpeg` is missing, or if we're outside the Tauri
 * shell.
 */
export async function transcribeVideo(
  path: string,
  onEvent?: ProgressListener,
): Promise<Transcription> {
  if (!isTauri()) {
    throw new Error(
      "A transcrição local só funciona dentro do app Pink Cut (Tauri). Rode `bun run tauri dev` para abrir o shell desktop.",
    );
  }
  if (!looksLikeAbsolutePath(path)) {
    // Catch the "dragged-in-the-browser" case here instead of letting
    // ffmpeg fail with a confusing "No such file or directory" — the
    // file picker is the only way to get an absolute path inside the
    // Tauri shell.
    throw new Error(
      `O caminho "${path}" não é um caminho absoluto. Use o botão "Browse files" para selecionar o vídeo dentro do app — drag-and-drop no navegador não tem o caminho completo do arquivo.`,
    );
  }

  // Subscribe to the Rust progress stream BEFORE invoking the command —
  // a slow model load would otherwise emit "preparing" before we were
  // listening and we'd miss the first ticks.
  const unlisten = await attachProgressListener(onEvent);

  emit(onEvent, {
    kind: "log",
    line: "Loading parakeet-tdt-0.6b-v3-int8 (int8 ONNX)…",
  });

  try {
    const transcription = await invoke<Transcription>("transcribe_path", {
      path,
    });
    emit(onEvent, {
      kind: "log",
      line: `Done — ${transcription.segments.length} segments, ${transcription.silences.length} silences.`,
    });
    return transcription;
  } finally {
    unlisten();
  }
}

/**
 * Returns true if `path` looks like an absolute filesystem path on the
 * current platform. Catches the classic "dragged in the browser, fallback
 * gave us a bare filename" case before ffmpeg has to fail on it.
 *
 *   ✓ "/Users/you/clip.mp4"
 *   ✓ "C:\\Users\\you\\clip.mp4"
 *   ✗ "clip.mp4"
 *   ✗ "./clip.mp4"
 *   ✗ "~/clip.mp4"
 */
function looksLikeAbsolutePath(path: string): boolean {
  if (!path) return false;
  if (path.startsWith("/")) return true;
  // Windows: "C:\..." or "C:/..." — drive letter followed by separator.
  if (/^[a-zA-Z]:[\\/]/.test(path)) return true;
  // UNC paths: "\\server\share\..."
  if (path.startsWith("\\\\")) return true;
  return false;
}

/**
 * Subscribes to the `transcribe://progress` Tauri event and re-shapes the
 * Rust payload into the JS `TranscribeEvent` union. Returns an unlisten
 * function — the caller is expected to call it on completion (or in a
 * `finally`) so we don't leak event listeners across runs.
 */
async function attachProgressListener(
  onEvent?: ProgressListener,
): Promise<UnlistenFn> {
  return listen<RustProgress>("transcribe://progress", (event) => {
    const payload = event.payload;
    switch (payload.stage) {
      case "preparing":
        emit(onEvent, {
          kind: "log",
          line: `Preparing: ${payload.message}`,
        });
        emit(onEvent, {
          kind: "progress",
          progress: { stage: "preparing", message: payload.message },
        });
        return;
      case "decoding":
        emit(onEvent, {
          kind: "progress",
          progress: {
            stage: "decoding",
            message: payload.message,
            ratio: payload.ratio,
          },
        });
        return;
      case "inferring":
        emit(onEvent, {
          kind: "log",
          line: payload.message,
        });
        emit(onEvent, {
          kind: "progress",
          progress: {
            stage: "inferring",
            message: payload.message,
            ratio: payload.ratio,
          },
        });
        return;
      case "assembling":
        emit(onEvent, {
          kind: "log",
          line: payload.message,
        });
        emit(onEvent, {
          kind: "progress",
          progress: { stage: "assembling", message: payload.message },
        });
        return;
      case "done":
        emit(onEvent, {
          kind: "progress",
          progress: {
            stage: "done",
            transcription: payload.transcription,
          },
        });
        return;
    }
  });
}

// Mirror of the Rust `TranscribeProgress` enum (see
// `src-tauri/src/transcription.rs`). Kept in sync by hand — small enough
// that the friction of a shared codegen step would dwarf the maintenance.
type RustProgress =
  | { stage: "preparing"; message: string }
  | { stage: "decoding"; message: string; ratio: number }
  | { stage: "inferring"; message: string; ratio: number }
  | { stage: "assembling"; message: string }
  | { stage: "done"; transcription: Transcription };

function emit(listener: ProgressListener | undefined, event: TranscribeEvent) {
  listener?.(event);
}
