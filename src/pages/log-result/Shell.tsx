import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Avatar } from "./ui";
import type { CurrentUser } from "./scoring";

interface ShellProps {
  title: string;
  me: CurrentUser;
  children: ReactNode;
  footer?: ReactNode;
  onBack?: () => void;
}

// Mobile-first responsive frame: full-bleed on a phone, centred max-w-lg from sm:.
// Self-contained immersive chrome (its own back button + lime brand mark) to match
// the signed-off prototype — intentionally not the app's AppNav/MainLayout.
export function Shell({ title, me, children, footer, onBack }: ShellProps) {
  return (
    <div className="min-h-screen bg-slate-100 font-sans antialiased flex flex-col">
      {/* <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto w-full max-w-lg flex items-center gap-2 px-3 sm:px-6 py-2.5">
          <button onClick={onBack} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors" aria-label="Back">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-lime-300 to-emerald-500 grid place-items-center shadow-sm shrink-0">
            <div className="h-4 w-4 rounded-full bg-white/90 ring-1 ring-emerald-700/20" />
          </div>
          <h1 className="text-base font-bold text-slate-900">{title}</h1>
          <div className="ml-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5">
            <Avatar name={me.name} size="h-7 w-7" text="text-xs" />
            <span className="text-xs font-bold text-slate-700">{me.ntrp}</span>
          </div>
        </div>
      </header> */}

      <main className="flex-1 w-full">
        <div className="mx-auto w-full max-w-lg px-4 sm:px-6 py-5 sm:py-8">{children}</div>
      </main>

      {footer && (
        <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="mx-auto w-full max-w-lg px-4 sm:px-6 pt-3 pb-4">{footer}</div>
        </div>
      )}
    </div>
  );
}
