import { useCallback, useEffect, useId, useState } from "react";
import { Film, Sparkles, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { usePickVideoFile, useTauriDrop } from "./use-pick-video-file";
import { VIDEO_ACCEPT, VIDEO_EXTENSIONS, type VideoFile } from "./types";

/**
 * First-touch upload form for the editor.
 *
 * Shown in the content band while the user hasn't picked a video yet. The
 * Studygram/Bujo treatment lives in three small choices:
 *   1. A soft dashed dropzone on a `Card` (paper feel, but no real texture
 *      — the design system already provides the warm off-white).
 *   2. A primary pink "Browse files" button + a tooltip-only icon for
 *      the secondary "paste a YouTube link" action (Zed-style minimalism).
 *   3. A small sticker badge ("new ✨") — pure decoration, no function.
 *
 * The component is presentation + form state only. The actual project
 * creation / import logic lives in the caller (today: AppShell).
 *
 * Drag-and-drop in the Tauri shell: Tauri 2 intercepts file drops before
 * the webview sees them and exposes absolute paths via
 * `getCurrentWebview().onDragDropEvent`. We subscribe to that and resolve
 * the next drop. The DOM `drop` handler is kept as a browser-only fallback
 * for `bun run dev` (and ignored in Tauri where the event is never fired).
 */
export function UploadVideoForm({
  onVideoSelected,
}: {
  onVideoSelected: (file: VideoFile) => void;
}) {
  const { pickVideoFile, isPicking, isTauri } = usePickVideoFile();
  const { available: tauriDrop, pickViaDrop } = useTauriDrop();
  const inputId = useId();

  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // In Tauri, prime the drop subscription lazily — we only want a pending
  // resolver while the form is on screen and the user is "aiming" at it.
  useEffect(() => {
    if (!tauriDrop) return;
    let cancelled = false;
    pickViaDrop()
      .then((file) => {
        if (cancelled || !file) return;
        setLocalError(null);
        onVideoSelected(file);
      })
      .catch(() => {
        // pickViaDrop never rejects; this is just to satisfy the linter.
      });
    return () => {
      cancelled = true;
    };
  }, [tauriDrop, pickViaDrop, onVideoSelected]);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      // Browser-only path — Tauri intercepts file drops before they reach
      // the DOM, so this branch only runs under `bun run dev`. We can't
      // get an absolute path here (the non-standard `File.path` is
      // Chromium-only); the editor surface will refuse to transcribe the
      // bare name with a clear error if the user tries.
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.type.startsWith("video/") && !hasVideoExtension(file.name)) {
        setLocalError(
          "That doesn't look like a video file. Try .mp4, .mov or .webm.",
        );
        return;
      }
      setLocalError(null);
      onVideoSelected({
        path: (file as File & { path?: string }).path ?? file.name,
        name: file.name,
        size: file.size,
      });
    },
    [onVideoSelected],
  );

  const handleBrowse = useCallback(async () => {
    setLocalError(null);
    const picked = await pickVideoFile();
    if (picked) onVideoSelected(picked);
  }, [pickVideoFile, onVideoSelected]);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      setIsDragging(false);
      if (isTauri) {
        // Tauri should have already fired the native event; this is
        // belt-and-suspenders. We intentionally don't process DOM drops
        // here because the bare `File.name` would corrupt the path.
        return;
      }
      handleFiles(event.dataTransfer.files);
    },
    [handleFiles, isTauri],
  );

  const dropHint = tauriDrop
    ? "Drop a file anywhere in the window"
    : "or use the button below — we accept " +
      formatExtensions(VIDEO_EXTENSIONS);

  return (
    <Card className="w-full max-w-xl border-dashed bg-card/80 shadow-sm ring-1 ring-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <span aria-hidden>🩷</span>
            Start a new edit
          </CardTitle>
          <Badge
            variant="secondary"
            className="rounded-full border border-primary/20 bg-primary/10 text-primary"
          >
            <Sparkles className="size-3" />
            new
          </Badge>
        </div>
        <CardDescription>
          Drop a video to transcribe and edit it like a doc. Pink Cut runs the
          whole pipeline locally — your file never leaves this machine.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <label
          htmlFor={inputId}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            isDragging
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-foreground",
          )}
        >
          <UploadCloud className="size-8" aria-hidden />
          <p className="text-sm">
            <span className="font-medium text-foreground">Drag &amp; drop</span>{" "}
            your video here
          </p>
          <p className="text-xs">{dropHint}</p>
          {!tauriDrop && (
            <input
              id={inputId}
              type="file"
              accept={VIDEO_ACCEPT}
              className="sr-only"
              onChange={(event) => handleFiles(event.target.files)}
            />
          )}
        </label>

        {localError && (
          <p role="alert" className="text-destructive text-xs">
            {localError}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={handleBrowse}
            disabled={isPicking}
            className="gap-1.5"
          >
            <Film className="size-4" />
            {isPicking ? "Opening…" : "Browse files"}
          </Button>

          {/* Secondary action kept iconic per the AGENTS.md "Zed-style"
              rule: no visible label, tooltip on hover. Wired to a no-op
              for now — YouTube import is a later milestone. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Paste a YouTube link"
                onClick={() =>
                  setLocalError("YouTube import is coming soon ✨")
                }
              >
                <YoutubeIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Paste a YouTube link</TooltipContent>
          </Tooltip>

          <span className="text-muted-foreground ml-auto text-[11px]">
            Local · Private ·{" "}
            <span className="rest align-baseline" aria-hidden="true">
              _
            </span>{" "}
            ready
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function hasVideoExtension(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase();
  if (!ext) return false;
  return (VIDEO_EXTENSIONS as readonly string[]).includes(ext);
}

function formatExtensions(extensions: readonly string[]): string {
  if (extensions.length === 0) return "video files";
  if (extensions.length === 1) return `.${extensions[0]}`;
  const head = extensions
    .slice(0, -1)
    .map((e) => `.${e}`)
    .join(", ");
  return `${head} or .${extensions[extensions.length - 1]}`;
}

/**
 * YouTube play glyph.
 *
 * lucide-react v1+ removed brand icons (trademark policy), so we render a
 * minimal monochrome mark inline. Same trick used in `Header` for GitHub.
 */
function YoutubeIcon() {
  return (
    <svg
      role="img"
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="currentColor"
    >
      <path d="M21.582 6.186a2.506 2.506 0 0 0-1.768-1.768C18.254 4 12 4 12 4s-6.254 0-7.814.418A2.506 2.506 0 0 0 2.418 6.186C2 7.746 2 12 2 12s0 4.254.418 5.814a2.506 2.506 0 0 0 1.768 1.768C5.746 20 12 20 12 20s6.254 0 7.814-.418a2.506 2.506 0 0 0 1.768-1.768C22 16.254 22 12 22 12s0-4.254-.418-5.814zM10 15.464V8.536L16 12l-6 3.464z" />
    </svg>
  );
}
