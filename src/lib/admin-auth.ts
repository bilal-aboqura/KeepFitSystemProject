import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type AdminAuthorization =
  | { user: User; denied: null }
  | { user: null; denied: NextResponse };

export async function requireAdminUser(): Promise<AdminAuthorization> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return {
      user: null,
      denied: NextResponse.json({ error: "Service unavailable" }, { status: 503 }),
    };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      user: null,
      denied: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return profile?.is_admin
    ? { user, denied: null }
    : {
        user: null,
        denied: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
}

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
  return (await requireAdminUser()).denied;
}
