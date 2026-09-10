"use client";
import { useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function CustomerAuth({ authenticated = false }: { authenticated?: boolean }) {
  const [pending, setPending] = useState(false);
  async function signIn() { setPending(true); const response = await fetch(`/api/customer/auth/google?next=${encodeURIComponent(location.pathname)}`, { method: "POST" }); const body = await response.json(); if (body.url) location.assign(body.url); else setPending(false); }
  async function signOut() { setPending(true); await getSupabaseBrowserClient()?.auth.signOut(); location.assign("/"); }
  return <button type="button" disabled={pending} onClick={authenticated ? signOut : signIn} className="flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm text-fg-muted transition hover:text-fg disabled:opacity-60" aria-busy={pending}>{authenticated ? <LogOut size={16} /> : <LogIn size={16} />}{authenticated ? "Sign out" : "Account"}</button>;
}
