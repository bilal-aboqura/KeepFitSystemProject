"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, X, ShoppingBag, MessageCircle } from "lucide-react";
import { useLang } from "@/components/language/provider";
import { LanguageToggle } from "@/components/language/toggle";
import { CartCounter } from "./cart-counter";

export function Navbar({ authenticated = false }: { authenticated?: boolean }) {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const ar = lang === "ar";

  const links = [
    { href: "/", label: t.nav.home },
    { href: "/supplements", label: ar ? "المكملات الغذائية" : "Supplements" },
    { href: "/performance", label: ar ? "الأداء الرياضي" : "Performance" },
    { href: "/contact", label: t.nav.contact },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050505]/92 backdrop-blur-xl">
      <nav className="mx-auto flex min-h-[72px] max-w-[96rem] items-center justify-between gap-3 px-5 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="flex min-h-14 items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
          aria-label={ar ? "KeepFit Supplement — الرئيسية" : "KeepFit Supplement — Home"}
        >
          <Image
            src="/keepfit-logo.png"
            alt="KeepFit Supplement"
            width={816}
            height={768}
            className="h-14 w-16 object-contain"
            priority
          />
          <span className="hidden text-start leading-none sm:block" dir="ltr">
            <span className="block text-base font-black tracking-[-0.02em] text-white">KEEPFIT</span>
            <span className="mt-1 block text-[10px] font-bold tracking-[0.16em] text-brand">SUPPLEMENT</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-bold text-white/70 transition hover:bg-white/5 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Link
            href={authenticated ? "/account" : "/sign-in"}
            className="hidden min-h-11 items-center rounded-lg border border-white/15 px-3 text-sm font-bold text-white/75 transition hover:border-brand hover:text-brand sm:flex"
          >
            {t.account.title}
          </Link>
          <a
            href="https://wa.me/201150301033"
            target="_blank"
            rel="noreferrer"
            aria-label="WhatsApp"
            className="flex size-11 items-center justify-center rounded-lg border border-white/15 text-white/65 transition hover:border-[#25D366]/60 hover:text-[#25D366] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <MessageCircle size={19} />
          </a>
          <Link
            href="/cart"
            aria-label={t.nav.cart}
            className="relative flex size-11 items-center justify-center rounded-lg bg-brand text-black transition hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <ShoppingBag size={19} />
            <CartCounter />
          </Link>
          <button
            type="button"
            aria-label={open ? (ar ? "إغلاق القائمة" : "Close menu") : (ar ? "فتح القائمة" : "Open menu")}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="flex size-11 items-center justify-center rounded-lg border border-white/15 text-white/70 transition hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {open ? (
        <div className="animate-slide-down border-t border-white/10 bg-[#080808] lg:hidden">
          <div className="mx-auto flex max-w-[96rem] flex-col px-5 py-4 sm:px-8">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center border-b border-white/8 px-2 text-base font-bold text-white/75 transition hover:text-brand"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href={authenticated ? "/account" : "/sign-in"}
              onClick={() => setOpen(false)}
              className="mt-3 inline-flex min-h-12 items-center justify-center rounded-lg border border-brand/60 text-base font-bold text-brand"
            >
              {t.account.title}
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
