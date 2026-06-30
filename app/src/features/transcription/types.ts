/**
 * Domain types for the `transcription` feature.
 *
 * These match what the local ASR pipeline (Parakeet TDT 0.6B v3 int8, see
 * `docs/asr-model-decision.md`) emits and what Silero VAD produces for
 * silence detection. Keeping word-level + silence-level timestamps in the
 * same shape lets the editor map *any* timestamp → text and *any* text →
 * audio range — the foundation of Descript-style text-based editing.
 *
 * Units: **milliseconds** (integer) throughout. Avoids float drift when we
 * serialise across the Tauri boundary.
 */

export type WordTiming = {
  /** Inclusive start of the word in source audio, in ms. */
  startMs: number;
  /** Exclusive end of the word in source audio, in ms. */
  endMs: number;
  /** The transcribed token, already punctuated. */
  text: string;
  /**
   * Optional confidence in [0, 1]. Parakeet emits per-token log-probs that
   * we normalise; the mock leaves it null. UI uses this to grey out
   * uncertain words.
   */
  confidence: number | null;
};

/**
 * A transcription segment is a short phrase (typically 5–15 words) the
 * model groups together. Pink Cut renders one card per segment; the user
 * can click a word to seek the player, or a card to cut the whole phrase.
 */
export type TranscriptionSegment = {
  id: string;
  startMs: number;
  endMs: number;
  words: WordTiming[];
};

/**
 * A detected silence. Renders as the 𝄾 quarter rest between segments —
 * the project's visual signature, mandated by AGENTS.md. The glyph is
 * actually the local "Quarter Rest" icon font (single glyph bound to
 * U+005F); we keep the canonical 𝄾 character in docs and the AGENTS.md
 * spec so the contract is stable even if we later swap the font.
 */
export type Silence = {
  startMs: number;
  endMs: number;
  /**
   * "soft" = < 800 ms, gentle pause we keep but visually mark.
   * "hard" = ≥ 800 ms, the user almost certainly wants to cut this.
   */
  kind: "soft" | "hard";
};

export type Transcription = {
  /** Schema version, bumped if the shape changes. */
  version: 1;
  /** Detected language (BCP-47-ish, e.g. `"pt"`, `"en"`). */
  language: string;
  /** Total audio duration covered by the transcription, in ms. */
  durationMs: number;
  /** Time-coded segments, sorted by `startMs`. */
  segments: TranscriptionSegment[];
  /** Detected silences, sorted by `startMs`. */
  silences: Silence[];
  /** When the transcription was produced (epoch ms). */
  createdAt: number;
};
