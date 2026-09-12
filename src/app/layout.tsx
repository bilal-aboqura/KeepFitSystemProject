import type { Metadata } from "next";
import { Alexandria, Almarai, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import Script from "next/script";
import { getLang } from "@/lib/i18n/server";

const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "1531675262043662";

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  variable: "--font-ibm-plex-sans-arabic",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const alexandria = Alexandria({
  subsets: ["arabic", "latin"],
  variable: "--font-alexandria",
  display: "swap",
});

const almarai = Almarai({
  subsets: ["arabic", "latin"],
  variable: "--font-almarai",
  weight: ["400", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000",
  ),
  title: {
    default: "KeepFit Supplement | مكملات غذائية ورياضية",
    template: "%s | KeepFit Supplement",
  },
  description:
    "تسوّق المكملات الغذائية والرياضية من KeepFit Supplement واختر المنتجات المناسبة لهدفك.",
  keywords: [
    "KeepFit Supplement",
    "مكملات غذائية",
    "مكملات رياضية",
    "sports supplements Egypt",
    "protein",
    "creatine",
    "fitness nutrition",
  ],
  authors: [{ name: "KeepFit Supplement" }],
  openGraph: {
    type: "website",
    locale: "ar_EG",
    alternateLocale: "en_US",
    siteName: "KeepFit Supplement",
    title: "KeepFit Supplement | مكملات غذائية ورياضية",
    description: "اختيارات من المكملات الغذائية والرياضية تناسب أهدافك المختلفة.",
  },
  twitter: {
    card: "summary_large_image",
    title: "KeepFit Supplement",
    description: "مكملاتك وأساسياتك الرياضية في مكان واحد.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const lang = await getLang();
  
  return (
    <html
      lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
      suppressHydrationWarning
      className={`${ibmPlexSansArabic.variable} ${alexandria.variable} ${almarai.variable} h-full antialiased scroll-smooth`}
    >
      <body className="min-h-full flex flex-col">
        <Script id="meta-pixel" strategy="beforeInteractive">
          {`
            if (!window.location.pathname.startsWith('/admin')) {
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window,document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init','${metaPixelId}');
              fbq('track','PageView');
              window.dispatchEvent(new Event('meta-pixel-ready'));
            }
          `}
        </Script>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
        <Providers initialLang={lang}>{children}</Providers>
      </body>
    </html>
  );
}
