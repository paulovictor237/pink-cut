import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/app-shell";

/**
 * Root component.
 *
 * Wraps the app in the providers that every page needs (tooltips + toasts)
 * and renders the 3-band layout (header / content / footer) described in
 * AGENTS.md. The actual feature surface (transcription, editor, etc.) is
 * still empty — this file just verifies the shell renders and the design
 * tokens are wired up correctly.
 */
function App() {
  return (
    <TooltipProvider delayDuration={150}>
      <AppShell />
      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}

export default App;
