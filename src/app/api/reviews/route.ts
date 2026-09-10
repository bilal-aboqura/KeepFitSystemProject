import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const ReviewSchema = z.object({
  product_id: z.string().uuid(),
  reviewer_name: z.string().trim().min(2).max(80),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(10).max(1500),
  website: z.string().max(0).optional(),
});

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 16 * 1024) {
    return NextResponse.json({ error: "Review is too large" }, { status: 413 });
  }

  const json = await request.json().catch(() => null);
  const parsed = ReviewSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 422 });
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }

  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", parsed.data.product_id)
    .eq("is_active", true)
    .maybeSingle();
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const { error } = await supabase.from("product_reviews").insert({
    product_id: parsed.data.product_id,
    reviewer_name: parsed.data.reviewer_name,
    rating: parsed.data.rating,
    title: parsed.data.title || null,
    body: parsed.data.body,
    status: "pending",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
