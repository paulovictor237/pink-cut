/**
 * Assets sidebar — the **left** sidebar of the editor.
 *
 * Per AGENTS.md, left = navigation/structure, right = properties/ajustes.
 * This panel shows every video that's been imported into the project
 * ("assets"), lets the user switch the active one, and (later) will show
 * scenes / markers. The Studygram/Bujo treatment comes from a few small
 * choices: a `Card`-shaped asset card, a small sticker badge for the
 * active one, and an empty state with a soft dashed border instead of a
 * spartan "no data" line.
 *
 * The sidebar is **persistent while the File menu is active** in the
 * footer (AGENTS.md) and closes via Esc / click-outside / re-click on the
 * File icon. That toggle is owned by the parent; this component is purely
 * presentation + selection.
 */
import { Film, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useProject } from "@/lib/project-context";
import { usePickVideoFile } from "@/features/media";
import { formatDuration, formatSize } from "./format";

export function AssetsSidebar() {
  const { assets, activeAssetId, setActive, removeAsset, addAsset } =
    useProject();
  const { pickVideoFile, isPicking } = usePickVideoFile();

  const handleAdd = async () => {
    try {
      const picked = await pickVideoFile();
      if (!picked) return;
      addAsset(picked);
    } catch {
      toast.error("Couldn't open the file picker. Try again.");
    }
  };

  return (
    <aside
      aria-label="Project assets"
      className="flex h-full w-72 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground"
    >
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <div>
          <h2 className="font-heading text-sm font-semibold tracking-wide">
            <span aria-hidden>🩷</span> Assets
          </h2>
          <p className="text-muted-foreground text-[11px]">
            {assets.length === 0
              ? "No videos yet"
              : `${assets.length} video${assets.length === 1 ? "" : "s"} in this project`}
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Add video"
              onClick={handleAdd}
              disabled={isPicking}
            >
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add another video</TooltipContent>
        </Tooltip>
      </header>

      <Separator />

      {assets.length === 0 ? (
        <EmptyState />
      ) : (
        <ScrollArea className="flex-1">
          <ul className="flex flex-col gap-2 p-3">
            {assets.map((asset) => {
              const isActive = asset.id === activeAssetId;
              return (
                <li key={asset.id}>
                  <button
                    type="button"
                    onClick={() => setActive(asset.id)}
                    className={cn(
                      "group/asset flex w-full flex-col gap-1.5 rounded-xl border bg-card/70 p-3 text-left transition-colors",
                      isActive
                        ? "border-primary/50 bg-primary/10 ring-1 ring-primary/30"
                        : "border-border/60 hover:border-primary/30 hover:bg-primary/5",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "flex items-center gap-1.5 truncate font-medium text-xs",
                          isActive ? "text-primary" : "text-foreground",
                        )}
                      >
                        <Film className="size-3.5 shrink-0" />
                        <span className="truncate">{asset.file.name}</span>
                      </span>
                      {isActive && (
                        <Badge
                          variant="secondary"
                          className="rounded-full border border-primary/30 bg-primary/15 px-1.5 py-0 text-[10px] text-primary"
                        >
                          active
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground flex items-center gap-2 text-[11px]">
                      <span>
                        {asset.durationMs != null
                          ? formatDuration(asset.durationMs)
                          : "—"}
                      </span>
                      <span aria-hidden>·</span>
                      <span>
                        {asset.file.size != null
                          ? formatSize(asset.file.size)
                          : "local file"}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}

      {assets.length > 0 && activeAssetId && (
        <>
          <Separator />
          <footer className="flex items-center justify-between gap-2 px-4 py-2">
            <span className="text-muted-foreground text-[11px]">
              Tip: click an asset to switch
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Remove active asset"
                  onClick={() => removeAsset(activeAssetId)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove from project</TooltipContent>
            </Tooltip>
          </footer>
        </>
      )}
    </aside>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="flex max-w-[200px] flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border/60 bg-card/40 p-4 text-center">
        <Film className="text-muted-foreground size-5" aria-hidden />
        <p className="text-muted-foreground text-xs">
          Your project is empty. Drop a video on the upload zone to start
          transcribing.
        </p>
      </div>
    </div>
  );
}
