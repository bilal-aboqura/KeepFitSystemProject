import { describe, expect, it } from "vitest";
import { createR2Mock } from "../../helpers/r2-mock";
import { detectCatalogImageMime, normalizeCatalogPrefix } from "@/lib/catalog/media/validation";
import { createR2CatalogStorage } from "@/lib/catalog/media/r2";
import { randomUUID } from "node:crypto";

describe("catalog media storage contract", () => {
  it("creates bounded upload intents without credentials", async () => {
    const storage = createR2Mock();
    const intent = await storage.createUploadIntent("catalog/products/p/m.webp", "image/webp");
    expect(intent.uploadUrl).not.toContain("secret");
    expect(intent.objectKey).toBe("catalog/products/p/m.webp");
  });

  it("cleanup is idempotent", async () => {
    const storage = createR2Mock();
    storage.objects.set("catalog/m.webp", { contentType: "image/webp", bytes: 10 });
    await storage.deleteObject("catalog/m.webp");
    await storage.deleteObject("catalog/m.webp");
    expect(storage.objects.has("catalog/m.webp")).toBe(false);
  });

  it("sniffs image signatures instead of trusting the filename", () => {
    expect(detectCatalogImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe("image/jpeg");
    expect(detectCatalogImageMime(new TextEncoder().encode("RIFF0000WEBP"))).toBe("image/webp");
    expect(detectCatalogImageMime(new TextEncoder().encode("not an image"))).toBe("");
    expect(normalizeCatalogPrefix("/staging/store/")).toBe("staging/store");
  });

  const canRunR2Smoke = Boolean(
    process.env.R2_ACCOUNT_ID
      && process.env.R2_ACCESS_KEY_ID
      && process.env.R2_SECRET_ACCESS_KEY
      && process.env.R2_BUCKET_NAME
      && process.env.NEXT_PUBLIC_R2_MEDIA_BASE_URL
      && process.env.CATALOG_MEDIA_ENV !== "production",
  );

  it.skipIf(!canRunR2Smoke)("smokes a non-production R2 upload and cleanup", async () => {
    const storage = createR2CatalogStorage();
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const mediaId = randomUUID();
    const intent = await storage.createUploadIntent({ mediaId, productId: randomUUID(), fileName: "smoke.png", mimeType: "image/png", byteSize: bytes.length });
    try {
      const uploaded = await fetch(intent.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: bytes });
      expect(uploaded.ok).toBe(true);
      await expect(storage.verifyObject(intent.objectKey)).resolves.toEqual({ mimeType: "image/png", byteSize: bytes.length });
    } finally {
      await storage.deleteObject(intent.objectKey);
    }
  });
});
