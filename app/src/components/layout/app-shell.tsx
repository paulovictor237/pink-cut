/**
 * 3-band layout described in AGENTS.md:
 *
 *   ┌────────────────────────────────────────────┐
 *   │                  Header                    │
 *   ├────────────────────────────────────────────┤
 *   │  ┌────────┬──────────────────────────┐    │
 *   │  │Sidebar │                          │    │
 *   │  │ (left) │      Content (editor)    │    │
 *   │  │        │                          │    │
 *   │  └────────┴──────────────────────────┘    │
 *   ├────────────────────────────────────────────┤
 *   │                  Footer                    │
 *   └────────────────────────────────────────────┘
 *
 * Routing rules:
 *   - No assets loaded          → show the upload form in the content band.
 *   - At least one asset        → show the editor surface; auto-open the
 *                                 "File" footer menu (which renders the
 *                                 left assets sidebar).
 *   - User toggles File in the  → opens/closes the left sidebar.
 *     footer
 *   - Esc / click outside       → closes the active sidebar.
 *
 * The header shows the active video's filename; the footer keeps the
 * iconic menu icons per AGENTS.md.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ProjectProvider, useProject } from "@/lib/project-context";
import { Footer, type MenuKey } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { UploadVideoForm, type VideoFile } from "@/features/media";
import { AssetsSidebar } from "@/features/project";
import { EditorSurface } from "@/features/editor";

export function AppShell() {
  return (
    <ProjectProvider>
      <AppShellInner />
    </ProjectProvider>
  );
}

function AppShellInner() {
  const { addAsset, activeAsset } = useProject();
  const [activeMenu, setActiveMenu] = useState<MenuKey | null>(null);
  // The shell flips this once when the first asset is added so the
  // sidebar auto-opens. After that the user owns the toggle.
  const didAutoOpenRef = useRef(false);

  const handleVideoSelected = (file: VideoFile) => {
    addAsset(file);
    toast.success(`Loaded ${file.name}`, {
      description: "Pick the transcription in the editor to start ✨",
    });
  };

  // Auto-open the File (left) sidebar the first time a video lands.
  useEffect(() => {
    if (activeAsset && !didAutoOpenRef.current) {
      didAutoOpenRef.current = true;
      setActiveMenu("file");
    }
  }, [activeAsset]);

  const handleToggle = (key: MenuKey) => {
    setActiveMenu((current) => (current === key ? null : key));
  };

  // Esc closes the active sidebar.
  useEffect(() => {
    if (activeMenu == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeMenu]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <Header filename={activeAsset?.file.name ?? null} />
      <main
        className="flex flex-1 overflow-hidden"
        onClick={() => {
          // Click outside the sidebar/footer dismisses the active sidebar.
          if (activeMenu != null) setActiveMenu(null);
        }}
      >
        {activeAsset ? (
          <EditorLayout leftOpen={activeMenu === "file"} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6">
            <UploadVideoForm onVideoSelected={handleVideoSelected} />
          </div>
        )}
      </main>
      <Footer activeMenu={activeMenu} onToggle={handleToggle} />
    </div>
  );
}

/**
 * Editor layout: left sidebar (assets) + central editor surface.
 * The sidebar is mounted but hidden when `leftOpen` is false so the
 * transition feels instant on toggle. We stop click propagation on the
 * container so clicks *inside* the editor don't trigger the parent's
 * "click outside" handler.
 */
function EditorLayout({ leftOpen }: { leftOpen: boolean }) {
  return (
    <div className="flex h-full w-full" onClick={(e) => e.stopPropagation()}>
      {leftOpen && (
        <div className="flex h-full w-72 shrink-0">
          <AssetsSidebar />
        </div>
      )}
      <EditorSurface />
    </div>
  );
}
