"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Link as LinkIcon, Loader2, Upload, X } from "lucide-react";
import { useToast } from "@/components/admin/toast";

const inputCls = "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-fg outline-none focus:border-brand";
const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;

export function ImageUpload({
  value,
  onChange,
  label = "Image",
  lang = "en",
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  lang?: "en" | "ar";
  aspectRatio?: number;
}) {
  const ar = lang === "ar";
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(ar ? "الملف ليس صورة" : "Not an image file");
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      toast.error(ar ? "الصورة كبيرة جداً (الحد الأقصى 20 ميجابايت)" : "Image too large (max 20MB)");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file, file.name);

      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      if (data.url) {
        onChange(data.url);
        toast.success(ar ? "تم رفع الصورة" : "Image uploaded");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : ar ? "فشل رفع الصورة" : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <span className="mb-1 block text-xs text-fg-dim">{label}</span>

      <div className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-white">
        {value ? (
          <>
            <Image src={value} alt="" fill sizes="160px" className="object-contain p-2" />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-lg bg-black/60 text-white/80 transition hover:bg-black/80 hover:text-white"
              title={ar ? "إزالة" : "Remove"}
            >
              <X size={12} />
            </button>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-fg-dim">
            {ar ? "لا توجد صورة" : "No image"}
          </div>
        )}
      </div>

      <div className="mt-2 flex gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-fg-muted transition hover:border-brand/40 hover:text-fg disabled:opacity-50"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? (ar ? "جارٍ الرفع..." : "Uploading...") : (ar ? "ارفع صورة" : "Upload")}
        </button>
        <button
          type="button"
          onClick={() => setShowUrlInput((current) => !current)}
          className="flex items-center justify-center gap-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-fg-muted transition hover:border-brand/40 hover:text-fg"
          title={ar ? "أدخل رابط" : "Enter URL"}
        >
          <LinkIcon size={14} />
        </button>
      </div>

      {showUrlInput && (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputCls} mt-1.5`}
          placeholder="/images/product.webp"
        />
      )}
    </div>
  );
}
