"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Loader2, Star, Trash2, Upload } from "lucide-react";
import type { CatalogMedia } from "@/lib/catalog/types";
import { useToast } from "./toast";

export function CatalogMediaManager({ productId, variantId, initialMedia, lang }: { productId: string; variantId?: string; initialMedia: CatalogMedia[]; lang: "en" | "ar" }) {
  const [media, setMedia] = useState(initialMedia);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const ar = lang === "ar";

  async function upload(file: File) {
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const metadata = { product_id: productId, variant_id: variantId, file_name: file.name, mime_type: file.type, byte_size: file.size, width: bitmap.width, height: bitmap.height };
      bitmap.close();
      const intentResponse = await fetch("/api/admin/catalog/media/upload-intents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(metadata) });
      const intent = await intentResponse.json();
      if (!intentResponse.ok) throw new Error(intent.error || "Upload intent failed");
      const put = await fetch(intent.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error("R2 upload failed");
      const confirmResponse = await fetch("/api/admin/catalog/media/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...metadata, media_id: intent.mediaId, object_key: intent.objectKey, alt_en: "", alt_ar: "", sort_order: media.length, is_primary: !variantId && media.length === 0 }) });
      const confirmed = await confirmResponse.json();
      if (!confirmResponse.ok) throw new Error(confirmed.error || "Upload confirmation failed");
      setMedia((current) => [...current, { id: confirmed.media_id, provider: "r2", object_key: intent.objectKey, mime_type: file.type, byte_size: file.size, width: metadata.width, height: metadata.height, alt_en: "", alt_ar: "", public_url: confirmed.public_url, sort_order: current.length, is_primary: !variantId && current.length === 0, archived_at: null }]);
      toast.success(ar ? "تم رفع الصورة" : "Media uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function update(id: string, data: { sort_order?: number; is_primary?: boolean }) {
    const response = await fetch(`/api/admin/catalog/media/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!response.ok) return toast.error(ar ? "تعذر تحديث الصورة" : "Could not update media");
    setMedia((current) => current.map((item) => ({ ...item, ...(item.id === id ? data : {}), ...(data.is_primary && item.id !== id ? { is_primary: false } : {}) })));
  }

  async function archive(id: string) {
    if (!confirm(ar ? "أرشفة هذه الصورة؟" : "Archive this media?")) return;
    const response = await fetch(`/api/admin/catalog/media/${id}`, { method: "DELETE" });
    if (!response.ok) return toast.error(ar ? "تعذرت الأرشفة" : "Could not archive media");
    setMedia((current) => current.filter((item) => item.id !== id));
  }

  return (
    <section className="rounded-2xl border border-border bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div><h3 className="font-semibold text-fg">{variantId ? (ar ? "صور الخيار" : "Variant media") : (ar ? "معرض المنتج" : "Product gallery")}</h3><p className="text-xs text-fg-dim">{ar ? "WebP أو PNG أو JPEG أو AVIF، حتى 10MB" : "WebP, PNG, JPEG, or AVIF up to 10 MB"}</p></div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])} />
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="btn btn-secondary min-h-11 gap-2">{busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}{ar ? "رفع" : "Upload"}</button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {media.map((item) => (
          <div key={item.id} className="rounded-xl border border-border p-2">
            <div className="relative aspect-square overflow-hidden rounded-lg bg-slate-50"><Image src={item.public_url} alt={item.alt_en} fill sizes="160px" className="object-contain" /></div>
            <div className="mt-2 flex justify-between gap-1">
              {!variantId && <button type="button" aria-label="Set primary" onClick={() => update(item.id, { is_primary: true })} className={item.is_primary ? "text-amber-500" : "text-fg-dim hover:text-amber-500"}><Star size={18} fill={item.is_primary ? "currentColor" : "none"} /></button>}
              <button type="button" aria-label="Archive media" onClick={() => archive(item.id)} className="ms-auto text-fg-dim hover:text-red-600"><Trash2 size={18} /></button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
