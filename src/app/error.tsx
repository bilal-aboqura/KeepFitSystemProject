"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
      <div className="glass-elevated max-w-md p-12">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
          <AlertTriangle size={28} />
        </div>
        <h1 className="mt-5 font-heading text-2xl font-bold text-fg">Something went wrong</h1>
        <p className="mt-2 text-sm text-fg-dim">An unexpected error occurred. Please try again.</p>
        {error.digest && <p className="mt-2 font-mono text-xs text-fg-dim">Error: {error.digest}</p>}
        <button onClick={reset} className="btn btn-primary mt-8 gap-2">
          <RotateCcw size={16} /> Try again
        </button>
      </div>
    </div>
  );
}
