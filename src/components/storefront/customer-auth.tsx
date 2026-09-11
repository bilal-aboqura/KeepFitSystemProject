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
  return <div><button type="button" disabled={pending} onClick={act} className="btn btn-secondary min-h-11" aria-busy={pending}>{pending ? t.account.loading : authenticated ? t.account.signOut : t.account.signIn}</button>{error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}</div>;
}
