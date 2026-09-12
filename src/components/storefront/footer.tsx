"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUpLeft, MapPin, MessageCircle, Phone, Mail } from "lucide-react";
import { useLang } from "@/components/language/provider";
import { NewsletterForm } from "@/components/storefront/newsletter-form";
import { cn } from "@/lib/utils";

const paymentLogos = [
  {
    src: "/payment-methods/visa.webp",
    alt: "Visa",
    width: 92,
    height: 30,
    className: "h-6 w-auto",
  },
  {
    src: "/payment-methods/mastercard.png",
    alt: "Mastercard",
    width: 92,
    height: 56,
    className: "h-8 w-auto",
  },
  {
    src: "/payment-methods/vodafone-cash.png",
    alt: "Vodafone Cash",
    width: 110,
    height: 40,
    className: "h-11 w-auto",
  },
  {
    src: "/payment-methods/instapay.png",
    alt: "InstaPay",
    width: 94,
    height: 40,
    className: "h-11 w-auto",
  },
] as const;

export function Footer() {
  const { t, lang } = useLang();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-black bg-[#090909] text-white">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.25fr_0.7fr_0.7fr_1.15fr] lg:gap-8">
          <div>
            <div className="flex items-center gap-3">
              <Image
                src="/keepfit-logo.png"
                alt={t.brand}
                width={816}
                height={768}
                className="h-16 w-20 object-contain"
              />
              <div>
                <span className="block text-lg font-black tracking-tight" dir="ltr">KeepFit Supplement</span>
                <span className="mt-1 block text-xs font-bold text-brand">{t.tagline}</span>
              </div>
            </div>
            <p className="mt-6 max-w-xs text-sm leading-7 text-white/65">{lang === "ar" ? "اختيارات مكملات وأساسيات تمرين تساعدك تمشي ناحية هدفك بثقة." : "Supplements and training essentials picked to help you move toward your goal with confidence."}</p>
            <a
              href="https://wa.me/201150301033"
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex min-h-11 items-center gap-2 bg-brand px-4 text-sm font-extrabold text-black transition hover:bg-brand-soft"
            >
              <MessageCircle size={17} />
              {lang === "ar" ? "تواصل معنا على واتساب" : "Chat on WhatsApp"}
              <ArrowUpLeft size={16} />
            </a>
          </div>

          <FooterColumn title={t.nav.products}>
            <FooterLink href="/#categories">{t.home.categories}</FooterLink>
            <FooterLink href="/#bestsellers">{t.home.featured}</FooterLink>
            <FooterLink href="/cart">{t.nav.cart}</FooterLink>
            <FooterLink href="/account">{t.account.title}</FooterLink>
          </FooterColumn>

          <FooterColumn title={t.footer.legal}>
            <FooterLink href="/terms-and-conditions">{t.footer.terms}</FooterLink>
            <FooterLink href="/return-and-exchange-policy">{t.footer.returns}</FooterLink>
            <FooterLink href="/contact">{t.nav.contact}</FooterLink>
          </FooterColumn>

          <div className="border-t border-white/10 pt-8 md:border-t-0 md:pt-0 lg:border-s lg:ps-8">
            <FooterColumn title={t.footer.contactInfo}>
              <ContactRow icon={<Phone size={15} />} label={t.footer.phone} value="+20 115 030 1033" href="tel:+201150301033" ltr />
              <ContactRow icon={<Mail size={15} />} label="Website" value="keepfitsupplement.com" href="https://keepfitsupplement.com" ltr />
              <ContactRow icon={<MapPin size={15} />} label={t.footer.address} value={t.footer.addressValue} />
            </FooterColumn>
            <div className="mt-7">
              <NewsletterForm />
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-7">
          <p className="text-sm font-semibold text-white">{t.footer.paymentMethods}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {paymentLogos.map((logo) => (
              <div
                key={logo.alt}
                className="flex h-14 min-w-28 items-center justify-center rounded-2xl border border-white/10 bg-white px-4"
              >
                <Image
                  src={logo.src}
                  alt={logo.alt}
                  width={logo.width}
                  height={logo.height}
                  className={cn("w-auto object-contain", logo.className)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-5 text-center text-xs text-white/55 sm:flex sm:items-center sm:justify-between sm:text-start">
          <p>
            &copy; {year} {t.brand}. {t.footer.rights}
          </p>
          <p className="mt-2 sm:mt-0">
            {t.footer.developedBy}{" "}
            <span className="text-white/75">Bilal Aboqura</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-sm font-bold text-white">{title}</h4>
      <ul className="mt-4 space-y-3">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-sm text-white/70 transition hover:text-white">
        {children}
      </Link>
    </li>
  );
}

function ContactRow({
  icon,
  label,
  value,
  href,
  ltr = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  ltr?: boolean;
}) {
  const content = href ? (
    <a
      href={href}
      dir={ltr ? "ltr" : undefined}
      className="mt-1 block text-sm text-white/70 transition hover:text-white"
    >
      {value}
    </a>
  ) : (
    <p dir={ltr ? "ltr" : undefined} className="mt-1 text-sm text-white/70">
      {value}
    </p>
  );

  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 text-white/75">{icon}</span>
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {content}
      </div>
    </li>
  );
}

