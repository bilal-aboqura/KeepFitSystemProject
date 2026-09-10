"use client";

import { useEffect } from "react";
import { trackMetaEvent, type MetaPixelContent } from "@/lib/meta-pixel";

interface MetaPurchaseProps {
  orderNumber: string;
  value: number;
  contents: MetaPixelContent[];
}

export function MetaPurchase({ orderNumber, value, contents }: MetaPurchaseProps) {
  useEffect(() => {
    const key = `meta-purchase:${orderNumber}`;
    if (sessionStorage.getItem(key)) return;

    trackMetaEvent("Purchase", {
      value,
      currency: "EGP",
      content_type: "product",
      content_ids: contents.map((item) => item.id),
      contents,
    }, orderNumber);
    sessionStorage.setItem(key, "1");
  }, [contents, orderNumber, value]);

  return null;
}
