import { serializeMoney } from "./money";
import type { PublicPriceProjection, ResolvedPrice } from "./types";

export function projectPublicPrice(price: ResolvedPrice): PublicPriceProjection {
  if (price.availability === "unavailable") {
    return { variantId: price.variantId, sellableUnitId: price.sellableUnitId, availability: "unavailable", code: "PRICE_UNAVAILABLE" };
  }
  return {
    variantId: price.variantId,
    sellableUnitId: price.sellableUnitId,
    availability: "priced",
    ...serializeMoney(price.amountMinor),
    isDerived: price.resolutionKind === "derived",
  };
}
