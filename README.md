<div align="center">
  <img src="public/images/logo.webp" alt="Xeemo Logo" width="150" />

  # Xeemo E-Commerce Platform 🚗✨
  **Premium Car Care Chemicals — Direct to Consumer**
  
  [![Next.js 16](https://img.shields.io/badge/Next.js-16.2.9-black?logo=next.js)](https://nextjs.org/)
  [![React 19](https://img.shields.io/badge/React-19.2.4-blue?logo=react)](https://react.dev/)
  [![Tailwind v4](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?logo=tailwindcss)](https://tailwindcss.com/)
  [![Supabase](https://img.shields.io/badge/Supabase-DB_%26_Auth-3ECF8E?logo=supabase)](https://supabase.com/)
</div>

<br />

Welcome to the **Xeemo** official storefront. This platform was custom-built from the ground up to provide a premium, lightning-fast shopping experience for automotive care products in Egypt.

Our goal was to create a digital storefront that reflects the high quality of Xeemo's products, combining stunning visual design with enterprise-grade performance and a powerful backend administration system.

---

## 🌟 What We Delivered

### 1. A Premium Shopping Experience
We moved away from generic, slow templates to build a highly customized, ultra-fast storefront.
- **Dynamic Hero Section:** Eye-catching auto-rotating product carousels with smooth fade, scale, and blur transitions that grab the customer's attention immediately.
- **Modern Glassmorphism Design:** Beautiful translucent overlays, subtle micro-animations, and a highly polished interface built with TailwindCSS v4.
- **Seamless Checkout:** A frictionless shopping cart and checkout process designed to maximize conversion rates.

### 2. Flawless Dual-Language Support (English & Arabic)
The platform is fully localized, offering a perfect experience regardless of the user's preferred language.
- **Native RTL Layouts:** Unlike basic translation plugins, the entire grid and UI structure physically flips and adapts perfectly for Arabic readers.
- **Zero-Flicker Translations:** Advanced server-side synchronization ensures that the website loads instantly in the correct language without any awkward "flashing" or layout shifts.

### 3. Comprehensive Admin Dashboard
A secure, custom-built control panel (`/admin`) that gives the business owner full control over the platform without needing technical knowledge.
- **Product & Order Management:** Add new products, update pricing, and track orders in real-time.
- **Live Analytics:** Track sales, customer growth, and business performance metrics instantly.

### 4. Marketing & Growth Ready
Built from day one to support scaling and advertising efforts.
- **Meta Pixel Integration:** We successfully integrated advanced Facebook/Instagram tracking (including exact `Purchase` values and currency) so you can precisely measure the Return on Ad Spend (ROAS) of your marketing campaigns.
- **Technical SEO:** Lightning-fast page loads (Next.js 16 Server Components) and semantic HTML structure ensure top-tier ranking potential on Google.

---

## 💡 The Technology Behind The Speed
To achieve this level of quality, we utilized the absolute latest in web technology:
- **Next.js 16 & React 19:** The gold standard for modern web applications, ensuring instant page transitions and massive SEO benefits.
- **Supabase (PostgreSQL):** A highly secure, scalable, and lightning-fast database architecture that safely stores all products, customer data, and orders.

---

<div align="center">
  <sub>Designed and developed for <strong>Xeemo Egypt</strong>. Delivering excellence in every pixel. 🚀</sub>
</div>


### Mylerz shipping

Set `MYLERZ_USERNAME` and `MYLERZ_PASSWORD` on the server. Optional settings:
`MYLERZ_API_URL` (defaults to `https://integration.mylerz.net`),
`MYLERZ_WAREHOUSE_NAME`, and `MYLERZ_DEFAULT_WEIGHT_KG` (defaults to 1 kg per package).
Never expose these values through `NEXT_PUBLIC_` variables.

Apply the additive migration with `node --env-file=.env.local scripts/migrate-mylerz.mjs`.
The full schema also includes these additions. Configure the same variables in the
hosting environment before deploying; `.env.local` is not committed.

Admin orders supports connection verification, creating shipments, manually syncing
tracking and downloading PDF waybills. Only a confirmed delivered status marks COD
as paid. Failed delivery and “out for delivery” do not count as delivered.

Shipment creation claims an order atomically across both carriers. If the carrier
request times out or saving its response fails, creation stays blocked to prevent
accidental duplicate shipments. Reconcile the order reference in the carrier account
and persist any existing shipment before clearing `orders.shipment_creation` for that
specific order. Do not clear the claim until the carrier outcome is known.

Run `node scripts/test-mylerz.mjs` for mocked integration checks; it creates no live shipments.

### 450 ml shipping offer and mobile checkout

Shipping is EGP 80 when every catalog product in the basket is 450 ml, including
any checkout add-on. Adding another size restores the destination's normal rate.
The existing free-shipping threshold still takes priority. Size is read from
the catalog's Weight / Size field, falling back to the product name only when
that field is empty; Arabic digits are supported. Cart text cannot override it.

Excluded governorates: Fayoum, Beni Suef, Minya, Assiut, Sohag, Qena, Luxor, Aswan,
Red Sea, New Valley, North Sinai, and South Sinai.

The same shipping policy runs for the checkout preview, saved orders and admin
item edits. Unknown shipping is never displayed as zero: checkout waits for a
current quote and provides retry controls on failure. Mobile checkout shows
shipping and the inclusive total above the form and in the fixed confirmation
bar. The add-to-cart dialog offers checkout or continued shopping.

Run `node scripts/test-shipping.mjs` for mocked shipping-policy checks.
These changes need an application deployment, with no database migration.
