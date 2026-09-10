import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isCustomerProfileComplete, resolveCustomerForUser } from "@/lib/customers/identity";

export async function GET(request: NextRequest) {
  const url = new URL(request.url); const code = url.searchParams.get("code");
  const next = url.searchParams.get("next"); const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/account";
  if (!code) return NextResponse.redirect(new URL("/?auth=failed", url));
  const sb = await getSupabaseServerClient();
  if (!sb) return NextResponse.redirect(new URL("/?auth=failed", url));
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  const customer = !error && data.user ? await resolveCustomerForUser(data.user) : null;
  if (!customer) return NextResponse.redirect(new URL("/?auth=failed", url));
  return NextResponse.redirect(new URL(isCustomerProfileComplete(customer) ? destination : "/account/complete-profile", url));
}
