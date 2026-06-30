/**
 * TranscriptView — renders a `Transcription` as a single Studygram-style
 * notebook page: cream paper, horizontal rules, a pink left margin, and
 * one transcription segment per ruled line.
 *
 * Visual contract (per AGENTS.md + latest product feedback):
 *   - The whole transcript is ONE notebook page (`<div class="notebook-page">`).
 *   - Each ASR segment starts on a new ruled line. Consecutive segments
 *     are stacked on adjacent lines with no blank row between them (the
 *     page is fully filled with text). A segment that doesn't fit on a
 *     single line wraps onto the next ruled line(s) instead of being
 *     truncated, so long sentences are never silently cut off.
 *   - Silences sit *at the end* of the segment line that closes them, as
 *     an inline 𝄾 glyph rendered with the local "Quarter Rest" font:
 *       - "soft" (< SILENCE_HARD_MS) → small, low-opacity glyph.
 *       - "hard" (≥ SILENCE_HARD_MS) → same glyph with a soft pink
 *         highlighter band, so the user can spot likely cut points at a
 *         glance.
 *     (The font's only glyph is bound to U+005F, so the markup writes
 *     a plain `_` and the `.rest` class swaps in the quarter-rest font.)
 *   - Every visual line is 40px tall (`line-height: 40px`, matching the
 *     rule gap in `.notebook-page`). `.notebook-line` keeps
 *     `min-height: 40px` so even an empty segment reserves its ruled
 *     line, and the text inside is free to wrap across multiple 40px
 *     lines when the segment is long. See `.notebook-line` in index.css.
 *   - A small, dim 1-based line number is rendered in the left margin
 *     (the band between the page edge and the pink margin line). It's
 *     absolutely positioned by `.notebook-line-number` in index.css so
 *     it never gets ellipsized when the line text is truncated. Marked
 *     aria-hidden so screen readers don't read "1, 2, 3, ..." before
 *     every segment.
 *   - Words keep their order; future milestones will let the user click a
 *     word to seek the player, or drag to delete a word.
 */
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Silence, Transcription } from "@/features/transcription";
import { classifySilence } from "@/features/transcription/silence-policy";

export function TranscriptView({
  transcription,
}: {
  transcription: Transcription;
}) {
  // Walk the segment list once, attaching to each segment the silence
  // (if any) that ends where the next segment starts. Rendering the 𝄾
  // inline at the end of its closing segment keeps every pair
  // "segment → silence" on a single ruled line.
  const rows = useMemo(() => buildRows(transcription), [transcription]);

  return (
    <div className="notebook-page" aria-label="Transcription">
      {rows.map((row) => (
        <SegmentLine
          key={row.segment.id}
          segment={row.segment}
          trailingSilence={row.trailingSilence}
          lineNumber={row.lineNumber}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row builder
// ---------------------------------------------------------------------------

type SegmentRow = {
  segment: Transcription["segments"][number];
  /** Silence that closes this segment, if any. Rendered inline at the
   * end of the line. */
  trailingSilence: Silence | null;
  /** 1-based line number, shown in the left margin. */
  lineNumber: number;
};

/**
 * Attach to each segment the silence (if any) that ends right where the
 * next segment begins. We pick "ends at the next segment's start" as the
 * matching predicate so the 𝄾 visually belongs to the segment the user
 * just *finished* reading, not the one that hasn't started yet.
 *
 * A 1 ms tolerance absorbs integer-rounding noise from the ASR/VAD
 * pipeline.
 */
function buildRows(transcription: Transcription): SegmentRow[] {
  const { segments, silences } = transcription;

  return segments.map((segment, i) => {
    const next = segments[i + 1];
    const trailingSilence = next
      ? (silences.find(
          (s) => s.startMs >= segment.endMs - 1 && s.endMs <= next.startMs + 1,
        ) ?? null)
      : null;

    return { segment, trailingSilence, lineNumber: i + 1 };
  });
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/**
 * A single ASR segment, starting on a new ruled line and wrapping onto
 * additional ruled lines if it's longer than the page width. The class
 * `.notebook-line` keeps `min-height: 40px` so the segment still claims
 * at least one ruled line on the notebook page even when it's empty.
 */
function SegmentLine({
  segment,
  trailingSilence,
  lineNumber,
}: {
  segment: Transcription["segments"][number];
  trailingSilence: Silence | null;
  lineNumber: number;
}) {
  return (
    <p className="notebook-line" data-segment-id={segment.id}>
      <span className="notebook-line-number" aria-hidden="true">
        {lineNumber}
      </span>
      {segment.words.map((word, i) => {
        const isSoft = word.confidence != null && word.confidence < 0.8;
        return (
          <span
            key={`${segment.id}-w-${i}`}
            className={cn(
              "rounded-sm transition-colors",
              isSoft && "text-muted-foreground/80 italic",
            )}
            data-start-ms={word.startMs}
            data-end-ms={word.endMs}
          >
            {i > 0 ? " " : ""}
            {word.text}
          </span>
        );
      })}
      {trailingSilence && <SilenceMark silence={trailingSilence} />}
    </p>
  );
}

/**
 * The quarter rest glyph, rendered inline at the end of the segment
 * that closes the silence. We render the literal `_` (U+005F) because
 * the local "Quarter Rest" font (shipped from fontello) maps its single
 * glyph to U+005F. The `.rest` class forces the right font-family and
 * the CSS `unicode-range: U+005F` ensures only the rest font handles
 * this character, so it never collides with a literal underscore in
 * surrounding text. The "soft" variant is dim and small; the "hard"
 * variant gets a soft pink highlighter band so likely cut points stand
 * out at a glance.
 */
function SilenceMark({ silence }: { silence: Silence }) {
  const kind = silence.kind ?? classifySilence(silence.endMs - silence.startMs);
  const durationMs = silence.endMs - silence.startMs;
  const label = kind === "hard" ? "Long silence" : "Brief pause";
  const tooltip = `${label} — ${formatMs(durationMs)}`;

  if (kind === "soft") {
    return (
      <span
        className="rest rest-soft ml-2 align-baseline"
        role="separator"
        aria-label={`${durationMs} ms pause`}
        title={tooltip}
      >
        _
      </span>
    );
  }

  // "hard" — same glyph, with a soft pink highlighter band behind it.
  return (
    <span
      className="rest ml-2 align-baseline"
      role="separator"
      aria-label={`Hard silence: ${formatMs(durationMs)}`}
      title={tooltip}
      style={{
        background:
          "linear-gradient(transparent 45%, oklch(var(--primary) / 0.25) 45%)",
        padding: "0 6px",
        borderRadius: 2,
      }}
    >
      _
    </span>
  );
}

function formatMs(ms: number) {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
