import "server-only";
import { randomUUID } from "node:crypto";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { CatalogError, catalogDatabaseError } from "../errors";
import { createR2CatalogStorage } from "./r2";
import { mediaConfirmSchema, mediaUploadIntentSchema } from "./validation";

export async function createCatalogUploadIntent(input: unknown) {
  const value = mediaUploadIntentSchema.parse(input);
  const db = getSupabaseServiceClient();
  if (!db) throw new CatalogError("Catalog database is unavailable", 503);
  const { data: product } = await db.from("products").select("id").eq("id", value.product_id).maybeSingle();
  if (!product) throw new CatalogError("Product not found", 404);
  if (value.variant_id) {
    const { data: variant } = await db.from("product_variants").select("id").eq("id", value.variant_id).eq("product_id", value.product_id).maybeSingle();
    if (!variant) throw new CatalogError("Variant does not belong to the product", 422);
  }
  const mediaId = randomUUID();
  return createR2CatalogStorage().createUploadIntent({ mediaId, productId: value.product_id, fileName: value.file_name, mimeType: value.mime_type, byteSize: value.byte_size });
}

export async function confirmCatalogUpload(input: unknown, actorId: string) {
  const value = mediaConfirmSchema.parse(input);
  const expectedPath = `/catalog/products/${value.product_id}/${value.media_id}.`;
  if (!value.object_key.includes(expectedPath)) throw new CatalogError("Media object key does not match its product intent", 422);
  const storage = createR2CatalogStorage();
  const verified = await storage.verifyObject(value.object_key);
  if (verified.mimeType !== value.mime_type || verified.byteSize !== value.byte_size) throw new CatalogError("Uploaded object metadata does not match the intent", 422);
  const db = getSupabaseServiceClient();
  if (!db) throw new CatalogError("Catalog database is unavailable", 503);
  const { data, error } = await db.rpc("catalog_confirm_media", { p_media: value, p_actor_id: actorId });
  if (error) throw catalogDatabaseError(error);
  return { ...(data as object), public_url: storage.buildPublicUrl(value.object_key) };
}

export async function updateCatalogMedia(mediaId: string, input: { sort_order?: number; is_primary?: boolean }, actorId: string) {
  const db = getSupabaseServiceClient();
  if (!db) throw new CatalogError("Catalog database is unavailable", 503);
  const { error } = await db.rpc("catalog_update_media", { p_media_id: mediaId, p_sort_order: input.sort_order ?? null, p_is_primary: input.is_primary ?? null, p_actor_id: actorId });
  if (error) throw catalogDatabaseError(error);
}

export async function archiveCatalogMedia(mediaId: string, actorId: string) {
  const db = getSupabaseServiceClient();
  if (!db) throw new CatalogError("Catalog database is unavailable", 503);
  const { error } = await db.rpc("catalog_archive_media", { p_media_id: mediaId, p_actor_id: actorId });
  if (error) throw catalogDatabaseError(error);
}
