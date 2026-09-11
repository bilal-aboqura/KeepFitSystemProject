import { Navbar } from "@/components/storefront/navbar";
import { Footer } from "@/components/storefront/footer";
import { WhatsAppFloat } from "@/components/storefront/whatsapp-float";
import { MetaPixel } from "@/components/storefront/meta-pixel";
import { CartAddPrompt } from "@/components/storefront/cart-add-prompt";
import { getCurrentCustomer } from "@/lib/customers/session";
import { isCustomerProfileComplete } from "@/lib/customers/identity";
import { getLang } from "@/lib/i18n/server";
import { ui } from "@/lib/i18n/translations";
import Link from "next/link";

/** Shared layout for all storefront routes (navbar + footer). */
export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const customer = await getCurrentCustomer();
  const t = ui[await getLang()].account;
  return (
    <>
      <MetaPixel />
      <Navbar authenticated={Boolean(customer)} />
      {customer && !isCustomerProfileComplete(customer) && <div className="border-b border-border px-5 py-3 text-center text-sm"><Link href="/account/complete-profile" className="underline">{t.complete}</Link> — {t.completionHint}</div>}
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppFloat />
      <CartAddPrompt />
    </>
  );
}
