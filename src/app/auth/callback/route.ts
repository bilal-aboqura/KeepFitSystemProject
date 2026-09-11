import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isCustomerProfileComplete, resolveCustomerForUser } from "@/lib/customers/identity";
import { safeReturnPath } from "@/lib/customers/return-path";
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const failed = () => NextResponse.redirect(new URL("/sign-in?auth=failed", url));
  if (!url.searchParams.get("code") || url.searchParams.has("error")) return failed();
  try {
    const sb = await getSupabaseServerClient();
    if (!sb) return failed();
    const { data, error } = await sb.auth.exchangeCodeForSession(url.searchParams.get("code")!);
    if (error || !data.user) return failed();
    const customer = await resolveCustomerForUser(data.user);
    const next = safeReturnPath(url.searchParams.get("next"));
    return NextResponse.redirect(new URL(isCustomerProfileComplete(customer) ? next : "/account/complete-profile?next=" + encodeURIComponent(next), url));
  } catch { return failed(); }
}
