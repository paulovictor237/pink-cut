import { Mic, Redo2, Save, Undo2 } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const GITHUB_URL = "https://github.com/paulovictor237/pink-cut";

/**
 * Open an external URL.
 *
 * In the Tauri desktop runtime we use the official `opener` plugin because
 * the webview does not implement `window.open`. In a plain browser (e.g.
 * `bun run dev` without the Tauri shell) we fall back to `window.open`.
 */
async function openExternal(url: string) {
  try {
    await openUrl(url);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

/**
 * Top band of the 3-band layout.
 *
 * Left: GitHub icon — the only external exit point of the app.
 * Right: iconic action buttons (undo/redo/save/mic) with pastel tooltips,
 *        plus a slot for video info (filename when a video is loaded).
 *
 * No text menus live here (per AGENTS.md).
 */
export function Header({ filename = null }: { filename?: string | null }) {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b bg-background/80 px-3 backdrop-blur">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open GitHub repository"
            onClick={() => openExternal(GITHUB_URL)}
          >
            <GithubIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View on GitHub</TooltipContent>
      </Tooltip>

      <div className="flex items-center gap-1">
        <HeaderAction icon={<Undo2 />} label="Undo" />
        <HeaderAction icon={<Redo2 />} label="Redo" />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <HeaderAction icon={<Save />} label="Save" />
        <HeaderAction icon={<Mic />} label="Record" />
        <Separator orientation="vertical" className="mx-2 h-5" />
        <span className="text-muted-foreground max-w-[28ch] truncate text-xs">
          {filename ?? "No video loaded"}
        </span>
      </div>
    </header>
  );
}

function HeaderAction({
  icon,
  label,
  disabled = true,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          disabled={disabled}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * GitHub mark (Octocat silhouette).
 *
 * lucide-react v1+ removed brand icons due to trademark policy, so we render
 * the official SVG inline. This is the only external exit point of the app.
 */
function GithubIcon() {
  return (
    <svg
      role="img"
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="currentColor"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.333-1.755-1.333-1.755-1.089-.745.083-.729.083-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}
