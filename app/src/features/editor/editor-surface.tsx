/**
 * Editor surface — the central "sheet" shown in the content band once a
 * video is loaded.
 *
 *   ┌──────────────────────────────────────────────┐
 *   │  filename.mp4 · 02:34 · 1080p                 │
 *   │  [▶ Start transcription]      [⏵ Play]      │
 *   ├──────────────────────────────────────────────┤
 *   │  Olá, tudo bem? 𝄾 Hoje eu vou ensinar…       │  ← transcript
 *   │  𝄾                                            │  ← hard silence
 *   │  A ideia é simples: transcrevemos…           │
 *   │  …                                            │
 *   └──────────────────────────────────────────────┘
 *
 * Per AGENTS.md:
 *   - The "Start transcription" button is iconic (▶ glyph + tooltip) —
 *     the action is primary and known, no visible label needed.
 *   - Silences are the 𝄾 quarter rest (rendered via the local
 *     "Quarter Rest" font, whose glyph lives at U+005F).
 *
 * The surface is dumb on purpose: it just reads from the project context
 * and the transcription hook, then renders. All routing / persistence
 * lives in AppShell.
 */
import { useCallback, useEffect } from "react";
import {
  AlertTriangle,
  CircleStop,
  Download,
  FilmIcon,
  Loader2,
  Music,
  Play,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProject } from "@/lib/project-context";
import { useModelStatus, useTranscription } from "@/features/transcription";
import { TranscriptView } from "./transcript-view";
import { TranscriptionProgress } from "./transcription-progress";

export function EditorSurface() {
  const { activeAsset, transcription, setTranscription } = useProject();
  const { run, state, reset } = useTranscription();
  const model = useModelStatus();

  // When the active asset changes, the hook resets. This keeps the
  // "Start transcription" affordance correct: re-run it for the new file.
  useEffect(() => {
    reset();
  }, [activeAsset?.id, reset]);

  const handleStart = useCallback(async () => {
    if (!activeAsset) return;
    if (state.kind === "running") return;
    try {
      const result = await run(activeAsset.file.path);
      setTranscription(activeAsset.id, result);
    } catch {
      // The hook already captures the error into `state`. Nothing more to
      // do here — the UI surfaces it via the progress card.
    }
  }, [activeAsset, run, setTranscription, state.kind]);

  if (!activeAsset) {
    // Defensive: the parent only mounts this surface when an asset exists.
    return null;
  }

  const isRunning = state.kind === "running";
  const isDone = transcription != null;
  const canStart = model.status === "ready" && !isRunning;

  return (
    <section
      aria-label="Editor"
      className="flex h-full flex-1 flex-col overflow-hidden bg-background"
    >
      <EditorTopbar
        filename={activeAsset.file.name}
        isRunning={isRunning}
        isDone={isDone}
        canStart={canStart}
        onStart={handleStart}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {model.status === "missing" || model.status === "downloading" ? (
          <ModelStatusBanner
            status={model.status}
            download={model.download}
            error={model.error}
            onDownload={model.startDownload}
          />
        ) : null}
        {isRunning ? (
          <TranscriptionProgress state={state} />
        ) : isDone && transcription ? (
          <ScrollArea className="min-h-0 flex-1">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-8">
              <TranscriptMeta transcription={transcription} />
              <TranscriptView transcription={transcription} />
              <NextActions onRestart={handleStart} />
            </div>
          </ScrollArea>
        ) : state.kind === "failed" ? (
          <FailedState message={state.error} onRetry={handleStart} />
        ) : canStart ? (
          <IdleState filename={activeAsset.file.name} onStart={handleStart} />
        ) : (
          // Model is being prepared (status === "unknown" on first paint).
          // Show a quiet hint instead of the call-to-action so the user
          // doesn't think the button is broken.
          <PreparingState />
        )}
      </div>
    </section>
  );
}

function EditorTopbar({
  filename,
  isRunning,
  isDone,
  canStart,
  onStart,
}: {
  filename: string;
  isRunning: boolean;
  isDone: boolean;
  canStart: boolean;
  onStart: () => void;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b bg-background/80 px-4 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2">
        <FilmIcon className="text-muted-foreground size-4 shrink-0" />
        <span className="truncate font-medium text-sm">{filename}</span>
        {isDone && (
          <Badge
            variant="secondary"
            className="rounded-full border border-primary/30 bg-primary/10 px-2 text-[10px] text-primary"
          >
            <Sparkles className="size-3" />
            transcribed
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={isRunning ? "destructive" : "default"}
              aria-label={
                isRunning ? "Cancel transcription" : "Start transcription"
              }
              onClick={onStart}
              disabled={!canStart && !isRunning}
            >
              {isRunning ? <Loader2 className="animate-spin" /> : <Play />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isRunning
              ? "Transcribing…"
              : canStart
                ? "Start transcription"
                : "Waiting for ASR model…"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Play video"
              disabled
            >
              <Music />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Play (coming soon)</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}

function IdleState({
  filename,
  onStart,
}: {
  filename: string;
  onStart: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
          <Wand2 className="size-6 text-primary" aria-hidden />
        </div>
        <div className="space-y-1">
          <h3 className="font-heading text-lg font-semibold">
            Ready to transcribe
          </h3>
          <p className="text-muted-foreground text-sm">
            <span className="font-medium text-foreground">{filename}</span> is
            loaded. Pink Cut will run the local Parakeet TDT model and mark
            every silence with a quarter rest — nothing leaves this machine.
          </p>
        </div>
        <Button onClick={onStart} className="gap-2">
          <Play className="size-4" />
          Start transcription
        </Button>
      </div>
    </div>
  );
}

function FailedState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center">
        <CircleStop className="size-6 text-destructive" aria-hidden />
        <h3 className="font-heading text-sm font-semibold">
          Transcription failed
        </h3>
        <p className="text-muted-foreground text-xs">{message}</p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}

function TranscriptMeta({
  transcription,
}: {
  transcription: {
    language: string;
    durationMs: number;
    segments: unknown[];
    silences: unknown[];
  };
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="text-[11px]">
        🌐 {transcription.language.toUpperCase()}
      </Badge>
      <Badge variant="outline" className="text-[11px]">
        ⏱ {formatHms(transcription.durationMs)}
      </Badge>
      <Badge variant="outline" className="text-[11px]">
        {transcription.segments.length} segments
      </Badge>
      <Badge variant="outline" className="text-[11px]">
        <span className="rest align-baseline" aria-hidden="true">
          _
        </span>{" "}
        {transcription.silences.length} silences
      </Badge>
    </div>
  );
}

function NextActions({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="mt-10 flex items-center justify-between border-t pt-6">
      <p className="text-muted-foreground text-xs">
        Editing (Filter Words · Double Takes · Silence Cuts) ships in the next
        milestone.
      </p>
      <Button size="sm" variant="ghost" onClick={onRestart}>
        <Sparkles className="size-3.5" />
        Re-run
      </Button>
    </div>
  );
}

function formatHms(ms: number) {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * First-run / error banner for the local ASR model. Sits above the editor
 * body and stays put across the idle/running/done states. Renders one of
 * three flavors:
 *   - `missing`    → "Model not installed" with a Download button.
 *   - `downloading` → live per-file progress (e.g. "encoder-model.onnx · 64 %").
 *   - `error`      → the banner swaps to a destructive variant.
 */
function ModelStatusBanner({
  status,
  download,
  error,
  onDownload,
}: {
  status: "missing" | "downloading";
  download: import("@/features/transcription").DownloadProgress | null;
  error: string | null;
  onDownload: () => void;
}) {
  if (error) {
    return (
      <div className="mx-auto mt-6 w-full max-w-3xl rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="space-y-1 text-xs">
            <p className="font-medium text-destructive">
              Falha ao baixar o modelo ASR
            </p>
            <p className="text-muted-foreground">{error}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={onDownload}
            >
              Tentar de novo
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "downloading") {
    const ratio = currentRatio(download);
    const label = currentLabel(download);
    return (
      <div className="mx-auto mt-6 w-full max-w-3xl rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <Loader2 className="mt-0.5 size-4 shrink-4 animate-spin text-primary" />
          <div className="flex-1 space-y-2">
            <p className="font-medium text-xs">Baixando modelo Parakeet TDT…</p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/15">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${Math.round(ratio * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-6 w-full max-w-3xl rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <Download className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="flex-1 space-y-1 text-xs">
          <p className="font-medium">Modelo ASR ainda não foi instalado</p>
          <p className="text-muted-foreground">
            O Pink Cut usa o Parakeet TDT 0.6B v3 (int8 ONNX, ~640 MB) para
            transcrever localmente. O download acontece uma vez só e fica salvo
            no seu app data dir.
          </p>
          <Button size="sm" className="mt-2 gap-1.5" onClick={onDownload}>
            <Download className="size-3.5" />
            Baixar modelo
          </Button>
        </div>
      </div>
    </div>
  );
}

function currentRatio(
  d: import("@/features/transcription").DownloadProgress | null,
): number {
  if (!d) return 0;
  if (d.stage === "progress") return d.ratio;
  if (d.stage === "file_done") return 1;
  if (d.stage === "all_done") return 1;
  if (d.stage === "started") return 0;
  return 0;
}

function currentLabel(
  d: import("@/features/transcription").DownloadProgress | null,
): string {
  if (!d) return "Preparando download…";
  if (d.stage === "started") {
    return `${d.file} (${d.index + 1}/${d.total}) — ${formatBytes(d.sizeBytes)}`;
  }
  if (d.stage === "progress") {
    return `${d.file} (${d.index + 1}/${d.total}) — ${Math.round(d.ratio * 100)}%`;
  }
  if (d.stage === "file_done") {
    return `${d.file} verificado (${d.index + 1}/${d.total})`;
  }
  if (d.stage === "all_done") {
    return "Download concluído. Carregando o modelo…";
  }
  return "";
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * Tiny placeholder shown on first paint while we wait for
 * `is_model_ready` to resolve. Keeps the surface from flashing the
 * "Ready to transcribe" call-to-action before the model status is
 * known.
 */
function PreparingState() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-md items-center gap-3 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Verificando modelo ASR local…
      </div>
    </div>
  );
}
