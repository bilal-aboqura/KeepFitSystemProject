"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  Menu,
  X,
  ShoppingBag,
  ChevronDown,
  Car,
  Bike,
  Armchair,
  Wind,
  House,
  MessageCircle,
} from "lucide-react";
import { useLang } from "@/components/language/provider";
import { LanguageToggle } from "@/components/language/toggle";
import { CartCounter } from "./cart-counter";

const PRODUCT_LINKS = [
  { href: "/category/carcare", key: "carcare" as const, Icon: Car },
  { href: "/category/motocare", key: "motocare" as const, Icon: Bike },
  { href: "/category/carpets", key: "carpets" as const, Icon: Armchair },
  { href: "/category/air-freshener", key: "freshener" as const, Icon: Wind },
  { href: "/category/home-care", key: "homecare" as const, Icon: House },
];

export function Navbar() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-ink/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-6 px-5">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <Image 
            src="/logo.png" 
            alt={t.brand} 
            width={160} 
            height={48} 
            className="h-12 w-auto object-contain brightness-0"
            priority 
          />
          {/* <div className="hidden sm:block">
            <span className="text-lg font-bold tracking-tight text-fg">
              {t.brand} {t.tagline}
            </span>
          </div> */}
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 lg:flex">
          <Link href="/" className="rounded-lg px-3 py-2 text-sm font-medium text-fg-muted transition hover:bg-white/[0.04] hover:text-fg">
            {t.nav.home}
          </Link>
          
          <div
            className="relative"
            onMouseEnter={() => setProductsOpen(true)}
            onMouseLeave={() => setProductsOpen(false)}
          >
            <button
              type="button"
              aria-expanded={productsOpen}
              aria-haspopup="menu"
              onClick={() => setProductsOpen((value) => !value)}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-fg-muted transition hover:bg-white/[0.04] hover:text-fg"
            >
              {t.nav.products}
              <ChevronDown
                size={14}
                className={`transition ${productsOpen ? "rotate-180 opacity-100" : "opacity-50"}`}
              />
            </button>
            <div
              className={`absolute left-0 top-full w-64 pt-2 transition-all duration-200 ${
                productsOpen
                  ? "visible translate-y-0 opacity-100"
                  : "invisible translate-y-1 opacity-0"
              }`}
            >
              <div className="glass-elevated p-2">
                {PRODUCT_LINKS.map(({ href, key, Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setProductsOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-fg-muted transition hover:bg-white/[0.06] hover:text-fg"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04]">
                      <Icon size={16} className="text-brand" />
                    </div>
                    <span>{t.nav[key]}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <Link href="/contact" className="rounded-lg px-3 py-2 text-sm font-medium text-fg-muted transition hover:bg-white/[0.04] hover:text-fg">
            {t.nav.contact}
          </Link>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <LanguageToggle />

          <a
            href="https://wa.me/201150301033"
            target="_blank"
            rel="noreferrer"
            aria-label="WhatsApp"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-fg-dim transition hover:border-[#25D366]/40 hover:text-[#25D366]"
          >
            <MessageCircle size={18} />
          </a>

          <Link
            href="/cart"
            aria-label={t.nav.cart}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border text-fg-dim transition hover:border-brand/40 hover:text-fg"
          >
            <ShoppingBag size={18} />
            <CartCounter />
          </Link>

          <button
            type="button"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-fg-dim transition hover:text-fg lg:hidden"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="animate-slide-down border-t border-border bg-ink/95 backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-4">
            <MobileLink href="/" onClick={() => setOpen(false)}>
              {t.nav.home}
            </MobileLink>
            <div className="mt-2 mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-fg-dim">
              {t.nav.products}
            </div>
            {PRODUCT_LINKS.map(({ href, key, Icon }) => (
              <MobileLink key={href} href={href} onClick={() => setOpen(false)}>
                <div className="flex items-center gap-3">
                  <Icon size={14} className="text-brand" />
                  <span>{t.nav[key]}</span>
                </div>
              </MobileLink>
            ))}
            <MobileLink href="/contact" onClick={() => setOpen(false)}>
              {t.nav.contact}
            </MobileLink>
          </div>
        </div>
      )}
    </header>
  );
}

function MobileLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="rounded-xl px-3 py-2.5 text-sm text-fg-muted transition hover:bg-white/[0.04] hover:text-fg"
    >
      {children}
    </Link>
  );
}
