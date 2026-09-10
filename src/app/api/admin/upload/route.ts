import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";

const BUCKET = "product-images";
const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;

/**
 * Ensure the storage bucket exists. Creates it if missing.
 * Uses the service role (bypasses RLS).
 */
async function ensureBucket(sb: ReturnType<typeof getSupabaseServiceClient>): Promise<boolean> {
  if (!sb) return false;

  // Try to list buckets — if our bucket exists, we're good
  const { data: buckets } = await sb.storage.listBuckets();
  if (buckets?.some((b) => b.name === BUCKET)) return true;

  // Bucket doesn't exist — create it
  const { error } = await sb.storage.createBucket(BUCKET, { public: true });
  if (error) {
    console.error("Failed to create bucket:", error.message);
    return false;
  }
  return true;
}

/**
 * POST /api/admin/upload — server-side image upload to Supabase Storage.
 * Accepts multipart/form-data with a "file" field.
 * Returns { url: string } on success.
 * Auto-creates the storage bucket if it doesn't exist.
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const sb = getSupabaseServiceClient();
  if (!sb) {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Not an image" }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json({ error: "Image too large (max 20MB)" }, { status: 400 });
  }

  // Ensure bucket exists before uploading
  const bucketReady = await ensureBucket(sb);
  if (!bucketReady) {
    return NextResponse.json(
      { error: `Could not create storage bucket "${BUCKET}". Check Supabase permissions.` },
      { status: 500 },
    );
  }

  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await sb.storage
    .from(BUCKET)
    .upload(fileName, arrayBuffer, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(fileName);

  return NextResponse.json({ url: urlData.publicUrl });
}
