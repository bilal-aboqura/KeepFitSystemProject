"use client";

import Image from "next/image";
import { useState } from "react";
import type { CatalogMedia } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";

export function ProductGallery({ productMedia, variantMedia, name }: { productMedia: CatalogMedia[]; variantMedia: CatalogMedia[]; name: string }) {
  const gallery = variantMedia.length ? variantMedia : productMedia;
  const [selected, setSelected] = useState(0);
  const current = gallery[Math.min(selected, Math.max(0, gallery.length - 1))];
  const src = current?.public_url ?? "/keepfit-logo.png";
  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-white">
        <Image src={src} alt={current?.alt_en || name} fill sizes="(max-width:1024px) 100vw, 50vw" priority className="object-contain p-6" />
      </div>
      {gallery.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {gallery.map((media, index) => (
            <button type="button" key={media.id} onClick={() => setSelected(index)} aria-label={`View image ${index + 1}`}
              className={cn("relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-white", index === selected ? "border-brand ring-2 ring-brand/20" : "border-border")}>
              <Image src={media.public_url} alt="" fill sizes="64px" className="object-contain p-1" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
