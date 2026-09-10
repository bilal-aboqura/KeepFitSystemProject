import { NextResponse } from "next/server";
import { getGovernoratesForCheckout } from "@/lib/data/locations";
import { getCheapestInCategory, getCheckoutSettings, getProductBySlug } from "@/lib/data/catalog";

/** GET /api/checkout-data → checkout options for cart and checkout screens. */
export async function GET() {
  const [governorates, settings] = await Promise.all([
    getGovernoratesForCheckout(),
    getCheckoutSettings(),
  ]);
  const selectedSlug = settings.bumpProductSlugs.length > 0
    ? settings.bumpProductSlugs[Math.floor(Math.random() * settings.bumpProductSlugs.length)]
    : null;
  const configuredBumpProduct = selectedSlug
    ? await getProductBySlug(selectedSlug)
    : null;
  const bumpProduct = configuredBumpProduct ?? await getCheapestInCategory("air-freshener");

  return NextResponse.json({
    governorates,
    freeShippingThreshold: settings.freeShippingThreshold,
    bumpProduct: bumpProduct
      ? {
          id: bumpProduct.id,
          slug: bumpProduct.slug,
          name_en: bumpProduct.name_en,
          name_ar: bumpProduct.name_ar,
          originalPrice: Number(bumpProduct.price),
          bumpPrice: settings.bumpPrice,
          desc_en: settings.bumpDesc_en,
          desc_ar: settings.bumpDesc_ar,
          image: bumpProduct.images?.[0] ?? null,
          stock: bumpProduct.stock,
        }
      : null,
  });
}
