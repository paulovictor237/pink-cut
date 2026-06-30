/**
 * Silence classification thresholds.
 *
 * We classify every detected silence into one of two buckets. The UI uses
 * the same numbers to decide how aggressively to render the 𝄾 marker:
 *   - "soft"  — a natural breath. Kept, but rendered as a faint 𝄾.
 *   - "hard"  — a pause the user almost certainly wants to cut. Rendered
 *               as a full-height 𝄾 card with a "remove" affordance.
 *
 * These are not hard science; they're product defaults the user can tune
 * in Settings later. The thresholds are exported so the editor and the
 * detection pipeline agree on the cut-off without duplicating magic
 * numbers.
 */
export const SILENCE_SOFT_MS = 200;
export const SILENCE_HARD_MS = 800;

/** Render hint for a silence, used by the transcript view. */
export function classifySilence(durationMs: number): "soft" | "hard" {
  return durationMs >= SILENCE_HARD_MS ? "hard" : "soft";
}
