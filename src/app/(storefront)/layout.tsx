import { Navbar } from "@/components/storefront/navbar";
import { Footer } from "@/components/storefront/footer";
import { WhatsAppFloat } from "@/components/storefront/whatsapp-float";
import { MetaPixel } from "@/components/storefront/meta-pixel";
import { CartAddPrompt } from "@/components/storefront/cart-add-prompt";

/** Shared layout for all storefront routes (navbar + footer). */
export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MetaPixel />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppFloat />
      <CartAddPrompt />
    </>
  );
}
