import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Verify the request comes from an authenticated admin user.
 * Returns null if authorized; returns a 401/403 JSON response if not.
 * Usage in API routes:
 * ```
 * const denied = await requireAdmin();
 * if (denied) return denied;
 * ```
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}
