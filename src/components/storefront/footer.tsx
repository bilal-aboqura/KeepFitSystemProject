"use client";

import Link from "next/link";
import Image from "next/image";
import { MessageCircle, ExternalLink, MapPin, Phone, Mail } from "lucide-react";
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
  const { t } = useLang();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-[#151515] text-white">
      <div className="mx-auto max-w-7xl px-5 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt={t.brand}
                width={120}
                height={32}
                className="h-8 w-auto object-contain brightness-0 invert"
              />
              <span className="text-lg font-bold tracking-tight">{t.brand}</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-white/70">{t.tagline}</p>
            <div className="mt-4 flex gap-2">
              <SocialLink
                href="https://wa.me/201150301033"
                label="WhatsApp"
                icon={<MessageCircle size={16} />}
              />
              <SocialLink
                href="https://www.facebook.com/officialxeemo"
                label="Facebook"
                icon={<ExternalLink size={16} />}
              />
            </div>
          </div>

          <FooterColumn title={t.nav.products}>
            <FooterLink href="/category/carcare">{t.nav.carcare}</FooterLink>
            <FooterLink href="/category/motocare">{t.nav.motocare}</FooterLink>
            <FooterLink href="/category/carpets">{t.nav.carpets}</FooterLink>
            <FooterLink href="/category/air-freshener">{t.nav.freshener}</FooterLink>
            <FooterLink href="/category/home-care">{t.nav.homecare}</FooterLink>
          </FooterColumn>

          <FooterColumn title={t.footer.legal}>
            <FooterLink href="/terms-and-conditions">{t.footer.terms}</FooterLink>
            <FooterLink href="/return-and-exchange-policy">{t.footer.returns}</FooterLink>
            <FooterLink href="/contact">{t.nav.contact}</FooterLink>
          </FooterColumn>

          <FooterColumn title={t.footer.contactInfo}>
            <ContactRow icon={<Phone size={15} />} label={t.footer.phone} value="+20 115 030 1033" href="tel:+201150301033" ltr />
            <ContactRow icon={<Mail size={15} />} label={t.footer.email} value="mohamed.xeemo@gmail.com" href="mailto:mohamed.xeemo@gmail.com" />
            <ContactRow icon={<MapPin size={15} />} label={t.footer.address} value={t.footer.addressValue} />
          </FooterColumn>
        </div>

        <div className="mt-8">
          <NewsletterForm />
        </div>

        <div className="mt-8 border-t border-white/10 pt-5">
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

function SocialLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/75 transition hover:border-white/35 hover:text-white"
    >
      {icon}
    </a>
  );
}
