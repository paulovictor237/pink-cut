import { useCallback, useEffect, useRef, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { VIDEO_ACCEPT, VIDEO_EXTENSIONS, type VideoFile } from "./types";

/**
 * `usePickVideoFile` opens the native file picker (Tauri `dialog` plugin
 * in the desktop shell, `<input type="file">` in the browser) and returns
 * a normalised `VideoFile` plus a tiny loading state.
 *
 * It also exposes a `pickViaDrop` promise that resolves the next time the
 * user drops a file inside the Tauri webview — Tauri's `onDragDropEvent`
 * is the *only* way to get the absolute path on a drop, because the
 * standard DOM `drop` event exposes `File` objects whose `.path` is
 * Chromium-only and undefined on `wkwebview` (macOS) and every Linux
 * WebKitGTK build. See `upload-video-form.tsx` for the drag-and-drop
 * wiring.
 *
 * Browser fallback: when the dialog plugin is unavailable we still surface
 * a usable `File` via a hidden `<input>` for `bun run dev` iteration, and
 * drop events go through the DOM as a best-effort.
 */
export function usePickVideoFile() {
  const [isPicking, setIsPicking] = useState(false);

  const pickVideoFile = useCallback(async (): Promise<VideoFile | null> => {
    setIsPicking(true);

    try {
      // 1) Tauri desktop path: real native dialog filtered to video files.
      const selected = await openDialog({
        multiple: false,
        directory: false,
        title: "Choose a video to edit",
        filters: [{ name: "Video", extensions: [...VIDEO_EXTENSIONS] }],
      });

      if (selected == null) return null;
      // The dialog plugin returns a string (single selection) or
      // string[] (multiple). We forced `multiple: false`, so it's a string.
      const path = Array.isArray(selected) ? selected[0] : selected;
      return pathToVideoFile(path);
    } catch {
      // 2) Browser fallback (dev / web). Uses a hidden <input> so we keep
      //    the same return type and don't burden the caller.
      return pickInBrowser();
    } finally {
      setIsPicking(false);
    }
  }, []);

  return { pickVideoFile, isPicking, isTauri: checkTauri() } as const;
}

/**
 * `useTauriDrop` returns a promise that resolves to a `VideoFile` the next
 * time the user drops a file inside the Tauri webview. The hook is a
 * thin wrapper around `getCurrentWebview().onDragDropEvent` that:
 *   - filters for video files by extension (ignoring non-video drops),
 *   - resolves the first matching path as a fully-typed `VideoFile`,
 *   - cleans up its listener even on rejection.
 *
 * Outside the Tauri shell, `pickViaDrop` resolves to `null` so the caller
 * can fall back to the DOM drop handler.
 */
export function useTauriDrop() {
  // Resolve the next drop (or null if not in Tauri). Kept in a ref so
  // multiple subscribers don't all get the same event.
  const resolverRef = useRef<((value: VideoFile | null) => void) | null>(null);
  const [available, setAvailable] = useState(checkTauri);

  useEffect(() => {
    if (!available) return;
    let unlisten: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        const webview = getCurrentWebview();
        unlisten = await webview.onDragDropEvent((event) => {
          if (event.payload.type !== "drop") return;
          if (cancelled) return;
          const path = firstVideoPath(event.payload.paths);
          if (path == null) return; // ignore non-video drops
          const resolve = resolverRef.current;
          if (!resolve) return;
          resolverRef.current = null;
          resolve(pathToVideoFile(path));
        });
      } catch {
        // Plugin not available — fall through to the DOM handler.
        setAvailable(false);
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [available]);

  /**
   * Resolves the next video drop with a `VideoFile` whose `path` is an
   * absolute filesystem path. Returns `null` immediately if we're not
   * inside the Tauri shell (caller should fall back to the DOM handler).
   */
  const pickViaDrop = useCallback((): Promise<VideoFile | null> => {
    if (!available) return Promise.resolve(null);
    return new Promise<VideoFile | null>((resolve) => {
      resolverRef.current = resolve;
    });
  }, [available]);

  return { available, pickViaDrop } as const;
}

function pathToVideoFile(path: string): VideoFile {
  // Tauri returns an absolute path; the basename is the last `/`-separated
  // segment. On Windows the path uses backslashes, so handle both.
  const segments = path.split(/[\\/]/);
  const name = segments[segments.length - 1] ?? path;
  return { path, name, size: null };
}

function firstVideoPath(paths: string[]): string | null {
  for (const p of paths) {
    if (hasVideoExtension(p)) return p;
  }
  return paths[0] ?? null;
}

function hasVideoExtension(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase();
  if (!ext) return false;
  return (VIDEO_EXTENSIONS as readonly string[]).includes(ext);
}

function checkTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    // @ts-expect-error — runtime-injected global.
    typeof window.__TAURI_INTERNALS__ !== "undefined"
  );
}

function pickInBrowser(): Promise<VideoFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = VIDEO_ACCEPT;
    input.style.position = "fixed";
    input.style.left = "-9999px";
    let settled = false;
    const cleanup = () => {
      if (input.parentNode) input.parentNode.removeChild(input);
    };
    const finish = (value: VideoFile | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    input.addEventListener(
      "change",
      () => {
        const file = input.files?.[0];
        if (!file) {
          finish(null);
          return;
        }
        // In the browser we don't have a real path; use the file name as
        // both `name` and a stand-in `path` so downstream code stays happy.
        finish({ path: file.name, name: file.name, size: file.size });
      },
      { once: true },
    );
    document.body.appendChild(input);
    input.click();
    // Safety net: if the user dismisses the picker, no events fire, so
    // we resolve null after a short window instead of leaking the input.
    setTimeout(() => finish(null), 60_000);
  });
}
