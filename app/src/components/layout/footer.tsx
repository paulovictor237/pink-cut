import {
  FileText,
  HelpCircle,
  Pencil,
  Plus,
  Settings,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type MenuKey = "file" | "edit" | "view" | "insert" | "settings" | "help";

const MENUS: Array<{
  key: MenuKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "file", label: "File", icon: FileText },
  { key: "edit", label: "Edit", icon: Pencil },
  { key: "view", label: "View", icon: Eye },
  { key: "insert", label: "Insert", icon: Plus },
  { key: "settings", label: "Settings", icon: Settings },
  { key: "help", label: "Help", icon: HelpCircle },
];

/**
 * Bottom band of the 3-band layout.
 *
 * Each icon is a menu trigger. Per AGENTS.md:
 *   - Footer shows only icons, never labels.
 *   - Tooltip on hover reveals the label in pastel style.
 *   - The active menu gets a primary-tinted highlight + small underline.
 *
 * Toggling is delegated to the parent via `activeMenu` / `onToggle` so the
 * AppShell can decide which sidebar (left/right) to open for each menu.
 */
export function Footer({
  activeMenu,
  onToggle,
}: {
  activeMenu: MenuKey | null;
  onToggle: (key: MenuKey) => void;
}) {
  return (
    <footer className="flex h-11 shrink-0 items-center justify-center gap-1 border-t bg-background/80 px-3 backdrop-blur">
      {MENUS.map(({ key, label, icon: Icon }) => {
        const isActive = activeMenu === key;
        return (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={label}
                aria-pressed={isActive}
                onClick={() => onToggle(key)}
                className={
                  isActive
                    ? "bg-primary/20 text-primary hover:bg-primary/25"
                    : undefined
                }
              >
                <Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </footer>
  );
}

export type { MenuKey };
