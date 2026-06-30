/**
 * `useModelStatus` — tells the UI whether the local Parakeet TDT model is
 * installed, and exposes a `download` action for the first-run banner.
 *
 * On mount we (a) feature-detect the Tauri shell, (b) call
 * `is_model_ready` to read the current state, and (c) subscribe to the
 * `model://status` event so the UI flips to "ready" without a reload
 * after the download finishes.
 *
 * The download itself streams `download://progress` events from the Rust
 * side; the hook exposes the latest one so the editor can show a
 * download bar (e.g. "encoder-model.onnx · 64%").
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** Tells the UI whether the model is installed and ready to run. */
export type ModelStatus = "unknown" | "missing" | "ready" | "downloading";

/** One streamed update from `download_model`. Mirrors `DownloadProgress` in
 * `src-tauri/src/model_manager.rs` — kept in sync by hand because the
 * surface is small. */
export type DownloadProgress =
  | {
      stage: "started";
      file: string;
      index: number;
      total: number;
      sizeBytes: number;
    }
  | { stage: "progress"; file: string; index: number; total: number; ratio: number }
  | { stage: "file_done"; file: string; index: number; total: number }
  | { stage: "all_done" }
  | { stage: "failed"; message: string };

function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    // @ts-expect-error — runtime-injected global.
    typeof window.__TAURI_INTERNALS__ !== "undefined"
  );
}

export function useModelStatus() {
  const [status, setStatus] = useState<ModelStatus>("unknown");
  const [download, setDownload] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refresh on mount + listen to the `model://status` event so a
  // successful download flips the UI without a reload.
  useEffect(() => {
    if (!isTauri()) {
      setStatus("missing");
      return;
    }

    let unlistenStatus: UnlistenFn | undefined;
    let cancelled = false;

    (async () => {
      try {
        const ready = await invoke<boolean>("is_model_ready");
        if (cancelled) return;
        setStatus(ready ? "ready" : "missing");
      } catch (e) {
        if (cancelled) return;
        setError(messageOf(e));
        setStatus("missing");
      }

      unlistenStatus = await listen<{ ready: boolean }>(
        "model://status",
        (event) => {
          setStatus(event.payload.ready ? "ready" : "missing");
        },
      );
    })();

    return () => {
      cancelled = true;
      unlistenStatus?.();
    };
  }, []);

  // Listen to download progress for the lifetime of the hook so the
  // "Downloading…" banner can show per-file ratios.
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: UnlistenFn | undefined;
    (async () => {
      unlisten = await listen<DownloadProgress>(
        "download://progress",
        (event) => {
          setDownload(event.payload);
          if (event.payload.stage === "all_done") {
            setStatus("ready");
          } else if (event.payload.stage === "failed") {
            setStatus("missing");
            setError(event.payload.message);
          }
        },
      );
    })();
    return () => unlisten?.();
  }, []);

  const startDownload = useCallback(async () => {
    if (!isTauri()) {
      setError("Download só funciona dentro do app Tauri.");
      return;
    }
    setStatus("downloading");
    setError(null);
    setDownload(null);
    try {
      await invoke("download_model");
    } catch (e) {
      setError(messageOf(e));
      setStatus("missing");
    }
  }, []);

  return useMemo(
    () => ({ status, download, error, startDownload }),
    [status, download, error, startDownload],
  );
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
