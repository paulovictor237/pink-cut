/**
 * Domain types for the `media` feature.
 *
 * A `VideoFile` is the in-memory representation of a video the user has
 * picked from disk (or — eventually — dragged into the app, recorded with
 * the mic, or pulled from a URL). It is intentionally minimal: the Tauri
 * runtime hands us an absolute path + a friendly name, and that is enough
 * to start the import/transcription pipeline. Metadata (duration,
 * resolution, fps, codec) is filled in by a later media-introspection
 * step.
 */
export type VideoFile = {
  /** Absolute path on disk (Tauri `open()` returns this). */
  path: string;
  /** Display name, e.g. `"recording-2026-06-30.mp4"`. */
  name: string;
  /** File size in bytes, or `null` if the runtime didn't provide one. */
  size: number | null;
};

/**
 * Accepted video extensions for the first-upload form.
 *
 * Kept as a tuple so we can also drive the native dialog's `filters`
 * option. Order matches how Descript/Descript-like editors usually list
 * them: the most common container first.
 */
export const VIDEO_EXTENSIONS = [
  "mp4",
  "mov",
  "webm",
  "mkv",
  "m4v",
] as const;

export type VideoExtension = (typeof VIDEO_EXTENSIONS)[number];

/** Human-friendly MIME-ish label for the dialog filter. */
export const VIDEO_ACCEPT = VIDEO_EXTENSIONS.map((ext) => `.${ext}`).join(",");
