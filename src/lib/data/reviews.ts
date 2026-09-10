import "server-only";

import { getSupabaseServerClient, getSupabaseServiceClient } from "@/lib/supabase/server";

export interface ProductReview {
  id: string;
  reviewer_name: string;
  rating: number;
  title: string | null;
  body: string;
  created_at: string;
}

export interface AdminProductReview extends ProductReview {
  product_id: string;
  status: "pending" | "approved" | "rejected";
  moderated_at: string | null;
  products: {
    name_en: string;
    name_ar: string;
    slug: string;
  } | null;
}

export async function getApprovedProductReviews(
  productId: string,
): Promise<ProductReview[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("product_reviews")
    .select("id, reviewer_name, rating, title, body, created_at")
    .eq("product_id", productId)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getApprovedProductReviews:", error.message);
    return [];
  }
  return (data ?? []) as ProductReview[];
}

export async function adminListProductReviews(): Promise<AdminProductReview[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("product_reviews")
    .select("id, product_id, reviewer_name, rating, title, body, status, moderated_at, created_at, products(name_en, name_ar, slug)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("adminListProductReviews:", error.message);
    return [];
  }
  return (data ?? []) as unknown as AdminProductReview[];
}
