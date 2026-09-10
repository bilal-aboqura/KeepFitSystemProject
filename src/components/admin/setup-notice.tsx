import { AlertCircle, ExternalLink } from "lucide-react";

export function SetupNotice() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-5 text-center">
      <div className="glass-elevated w-full p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
          <AlertCircle size={28} />
        </div>
        <h1 className="mt-5 font-heading text-2xl font-bold text-fg">Admin setup required</h1>
        <p className="mt-2 text-sm text-fg-dim">Supabase must be configured before you can sign in.</p>
        <ol className="mx-auto mt-6 max-w-sm space-y-3 text-left text-sm text-fg-dim">
          <li className="flex gap-2"><span className="font-semibold text-brand">1.</span><span>Create a project at <a href="https://supabase.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-fg underline decoration-border hover:decoration-brand">supabase.com <ExternalLink size={11} /></a></span></li>
          <li className="flex gap-2"><span className="font-semibold text-brand">2.</span><span>Copy keys into <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-xs">.env.local</code></span></li>
          <li className="flex gap-2"><span className="font-semibold text-brand">3.</span><span>Restart dev server and run the migration.</span></li>
        </ol>
      </div>
    </div>
  );
}
