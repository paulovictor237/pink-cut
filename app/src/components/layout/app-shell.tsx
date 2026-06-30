import { useState } from "react";
import { Footer, type MenuKey } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

/**
 * 3-band layout described in AGENTS.md:
 *
 *   ┌─────────────────────────────────────────┐
 *   │              Header                     │
 *   ├─────────────────────────────────────────┤
 *   │              Content                    │
 *   ├─────────────────────────────────────────┤
 *   │              Footer                     │
 *   └─────────────────────────────────────────┘
 *
 * Sidebars (left/right) will be slotted into the content band once feature
 * work begins. For now the content area shows a friendly placeholder so the
 * shell is visually verifiable.
 */
export function AppShell() {
  const [activeMenu, setActiveMenu] = useState<MenuKey | null>(null);

  const handleToggle = (key: MenuKey) => {
    setActiveMenu((current) => (current === key ? null : key));
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <Header />
      <main className="flex flex-1 items-center justify-center overflow-hidden">
        <div className="text-center">
          <p className="text-muted-foreground text-sm">Pink Cut</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Text-based video editor
          </h1>
          <p className="text-muted-foreground mt-3 text-xs">
            Shell ready. Feature work begins next.
          </p>
        </div>
      </main>
      <Footer activeMenu={activeMenu} onToggle={handleToggle} />
    </div>
  );
}
