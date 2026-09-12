"use client";
import { useRef, useState } from "react";
import { useLang } from "@/components/language/provider";
export function CustomerAuth({ authenticated = false, next = "/account" }: { authenticated?: boolean; next?: string }) {
  const { t } = useLang();
  const [pending,setPending] = useState(false);
  const [error,setError] = useState("");
  const busy = useRef(false);
  async function act() {
    if(busy.current) return;
    busy.current=true; setPending(true); setError("");
    try {
      const r = await fetch(authenticated ? "/api/customer/auth/logout" : "/api/customer/auth/google?next="+encodeURIComponent(next),{method:"POST"});
      const body = await r.json();
      if(!r.ok) throw new Error();
      window.location.assign(authenticated ? "/" : body.url);
    } catch { setError(t.account.error); busy.current=false; setPending(false); }
  }
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={act}
        className="flex min-h-14 w-full items-center justify-center gap-3 border border-black bg-white px-5 text-base font-extrabold text-black transition hover:bg-brand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
        aria-busy={pending}
      >
        {!authenticated && !pending ? <GoogleMark /> : null}
        {pending ? t.account.loading : authenticated ? t.account.signOut : t.account.signIn}
      </button>
      {error && <p role="alert" className="mt-3 border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" focusable="false">
      <path fill="#4285F4" d="M21.8 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.5a4.7 4.7 0 0 1-2.04 3.08v2.52h3.3c1.94-1.79 3.04-4.43 3.04-7.43Z" />
      <path fill="#34A853" d="M12 22c2.75 0 5.06-.91 6.75-2.34l-3.3-2.52c-.91.61-2.08.98-3.45.98-2.65 0-4.9-1.79-5.7-4.2H2.9v2.6A10.2 10.2 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.3 13.92A6.1 6.1 0 0 1 6 12c0-.67.12-1.32.3-1.92V7.48H2.9A10.2 10.2 0 0 0 1.8 12c0 1.64.4 3.19 1.1 4.52l3.4-2.6Z" />
      <path fill="#EA4335" d="M12 5.88c1.5 0 2.84.51 3.9 1.51l2.92-2.92C17.05 2.82 14.75 2 12 2a10.2 10.2 0 0 0-9.1 5.48l3.4 2.6c.8-2.41 3.05-4.2 5.7-4.2Z" />
    </svg>
  );
}
