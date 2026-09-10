"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useLang } from "@/components/language/provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const { lang } = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const configured = Boolean(getSupabaseBrowserClient());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    params.get("error") === "notadmin"
      ? lang === "ar"
        ? "هذا الحساب ليس مديرًا."
        : "This account is not an admin."
      : null,
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError(
        lang === "ar"
          ? "Supabase غير مُعد. أضف المفاتيح في .env.local"
          : "Supabase isn't configured. Add keys to .env.local.",
      );
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      const next = params.get("next") ?? "/admin";
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : lang === "ar"
            ? "فشل تسجيل الدخول."
            : "Sign-in failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4">
      <form onSubmit={handleSubmit} className="glass p-8 text-center">
        <div className="mb-6 flex justify-center">
          <Image 
            src="/logo.png" 
            alt="Xeemo" 
            width={160} 
            height={48} 
            className="h-12 w-auto object-contain brightness-0"
          />
        </div>
        <h1 className="font-display text-3xl tracking-wide text-fg">
          Xeemo{" "}
          <span className="text-xs uppercase tracking-[0.2em] text-brand">
            Admin
          </span>
        </h1>
        <p className="mt-1 text-sm text-fg-dim">
          {lang === "ar" ? "تسجيل دخول المالك" : "Owner sign in"}
        </p>

        <label className="mt-6 block text-xs uppercase tracking-widest text-fg-muted">
          {lang === "ar" ? "البريد الإلكتروني" : "Email"}
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-fg outline-none focus:border-brand"
        />

        <label className="mt-4 block text-xs uppercase tracking-widest text-fg-muted">
          {lang === "ar" ? "كلمة المرور" : "Password"}
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-fg outline-none focus:border-brand"
        />

        {error && (
          <p className="mt-4 rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-sm text-brand-soft">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !configured}
          className="mt-6 w-full rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
        >
          {loading
            ? lang === "ar"
              ? "جارٍ الدخول..."
              : "Signing in…"
            : lang === "ar"
              ? "دخول"
              : "Sign in"}
        </button>
        {!configured && (
          <p className="mt-3 text-center text-xs text-fg-dim">
            {lang === "ar"
              ? "(في وضع التجهيز — أضف مفاتيح Supabase)"
              : "(scaffold mode — add Supabase keys)"}
          </p>
        )}
      </form>
    </div>
  );
}
