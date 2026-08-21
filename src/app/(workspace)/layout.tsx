import { Suspense, type ReactNode } from "react";
import { AppHeader } from "@/components/shell/app-header";
import { ContextBar } from "@/components/shell/context-bar";
import { WorkspaceProvider } from "@/components/workspace/workspace-context";

/** Chrome shared by every workspace view. Selection state lives in the URL, so
 *  the provider sits above the header and the context bar alike. */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<BootSkeleton />}>
      <WorkspaceProvider>
        <div className="flex min-h-dvh flex-col bg-canvas">
          <AppHeader />
          <ContextBar />
          <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-5 lg:px-7 lg:py-6">
            {children}
          </main>
          <footer className="border-t border-line bg-surface-muted">
            <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-5 gap-y-1 px-5 py-3.5 text-[11.5px] text-ink-4 lg:px-7">
              <span>Solar Forecast Model Leaderboard · v2 prototype</span>
              <span>Historical evaluation only — not a scheduling or settlement system</span>
              <span className="ml-auto">All figures shown are simulated data</span>
            </div>
          </footer>
        </div>
      </WorkspaceProvider>
    </Suspense>
  );
}

function BootSkeleton() {
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="h-[58px] bg-masthead" />
      <div className="border-b border-line bg-surface-muted px-7 py-3.5">
        <div className="skeleton h-[46px] w-[420px] rounded-[11px]" />
      </div>
      <div className="mx-auto max-w-[1600px] space-y-4 px-7 py-6">
        <div className="skeleton h-[112px] rounded-[14px]" />
        <div className="skeleton h-[320px] rounded-[14px]" />
      </div>
    </div>
  );
}
