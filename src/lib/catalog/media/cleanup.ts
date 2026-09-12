import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { CatalogError, catalogDatabaseError } from "../errors";
import type { CatalogMediaStorage } from "./storage";

export async function deleteCatalogMediaIfUnreferenced(mediaId: string, storage: CatalogMediaStorage) {
  const db = getSupabaseServiceClient();
  if (!db) throw new CatalogError("Catalog database is unavailable", 503);
  const { data: media, error } = await db.from("catalog_media").select("id,provider,object_key,archived_at").eq("id", mediaId).maybeSingle();
  if (error) throw catalogDatabaseError(error);
  if (!media || media.provider !== "r2" || !media.archived_at) return { deleted: false, reason: "not_archived" };
  const [productRefs, variantRefs] = await Promise.all([
    db.from("product_media").select("id", { count: "exact", head: true }).eq("media_id", mediaId).is("archived_at", null),
    db.from("variant_media").select("id", { count: "exact", head: true }).eq("media_id", mediaId).is("archived_at", null),
  ]);
  if ((productRefs.count ?? 0) + (variantRefs.count ?? 0) > 0) return { deleted: false, reason: "referenced" };
  await storage.deleteObject(media.object_key);
  await db.from("catalog_media").update({ cleanup_after: null, updated_at: new Date().toISOString() }).eq("id", mediaId);
  return { deleted: true };
}
