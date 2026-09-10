"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackMetaEvent } from "@/lib/meta-pixel";
import { trackStoreEvent } from "@/lib/store-analytics";

export function MetaPixel() {
  const pathname = usePathname();
  const isInitialPage = useRef(true);
  useEffect(() => {
    if (!pathname) return;
    trackStoreEvent("page_view", pathname);
    if (!isInitialPage.current) trackMetaEvent("PageView");
    isInitialPage.current = false;
  }, [pathname]);

  return null;
}
