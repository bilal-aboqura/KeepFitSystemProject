"use client";

import { useState } from "react";
import { useLang } from "@/components/language/provider";

export function NewsletterForm() {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "exists" | "error">("idle");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const payload = (await response.json().catch(() => null)) as { status?: string } | null;

      if (response.ok) {
        setEmail("");
        setStatus(payload?.status === "exists" ? "exists" : "success");
        return;
      }

      setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  const message =
    status === "success"
      ? t.footer.newsletterSuccess
      : status === "exists"
        ? t.footer.newsletterExists
        : status === "error"
          ? t.footer.newsletterError
          : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h4 className="text-base font-semibold text-white">{t.footer.newsletterTitle}</h4>
      <p className="mt-2 text-sm leading-6 text-white/65">{t.footer.newsletterBody}</p>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t.footer.newsletterPlaceholder}
          className="min-w-0 flex-1 rounded-xl border border-white/12 bg-white px-4 py-3 text-sm text-fg outline-none transition placeholder:text-fg-dim focus:border-brand"
          required
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? t.footer.newsletterLoading : t.footer.newsletterCta}
        </button>
      </form>

      {message ? (
        <p className="mt-3 text-sm text-white/72">{message}</p>
      ) : null}
    </div>
  );
}
