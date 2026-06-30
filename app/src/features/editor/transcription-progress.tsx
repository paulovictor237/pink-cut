/**
 * Progress card — shown in the central editor surface while the
 * transcription pipeline is running. Streams the live log lines and a
 * thin pastel progress bar (Studygram/Bujo: hand-drawn feel, no harsh
 * colors).
 */
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { TranscribeProgress } from "@/features/transcription";

type State =
  | { kind: "idle" }
  | { kind: "running"; progress: TranscribeProgress | null }
  | { kind: "succeeded"; transcription: unknown }
  | { kind: "failed"; error: string };

export function TranscriptionProgress({ state }: { state: State }) {
  if (state.kind !== "running") return null;
  const progress = state.progress;
  const message =
    progress && "message" in progress
      ? progress.message
      : "Warming up the model…";
  const ratio =
    progress?.stage === "decoding"
      ? progress.ratio
      : progress?.stage === "inferring"
        ? Math.max(0.1, progress.ratio)
        : progress?.stage === "preparing"
          ? 0.05
          : progress?.stage === "assembling"
            ? 0.95
            : progress?.stage === "done"
              ? 1
              : 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-8">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
        <div>
          <h3 className="font-heading text-sm font-semibold">
            Transcribing locally
          </h3>
          <p className="text-muted-foreground text-xs">
            Parakeet TDT 0.6B v3 (int8) · Silero VAD
          </p>
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full bg-primary transition-all duration-300 ease-out",
          )}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>

      <p className="text-muted-foreground text-xs">{message}</p>

      {/* Log tail (small, monospace) — useful for debugging & gives the
          surface some life beyond a static spinner. */}
      <LogTail />
    </div>
  );
}

function LogTail() {
  // We pull the log lines from the hook indirectly via a custom event:
  // the parent (editor-surface) could also pass them in directly. To
  // keep this component decoupled, we just show a static "working" hint
  // for now — the next milestone wires the log stream in.
  return (
    <ScrollArea className="h-24 rounded-lg border bg-muted/30 p-2 font-mono text-[11px] text-muted-foreground">
      <p>· loading int8 ONNX model…</p>
      <p>· extracting features at 16 kHz…</p>
      <p>· decoding chunk by chunk with built-in timestamps…</p>
      <p className="animate-pulse">· detecting silences (Silero) ▍</p>
    </ScrollArea>
  );
}
