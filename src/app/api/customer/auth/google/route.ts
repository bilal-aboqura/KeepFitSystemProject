import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/customers/return-path";
export async function POST(request: NextRequest) {
  try {
    const sb = await getSupabaseServerClient();
    if (!sb) return NextResponse.json({ error: "Authentication unavailable" }, { status: 503 });
    const callback = new URL("/auth/callback", process.env.NEXT_PUBLIC_SITE_URL || request.url);
    callback.searchParams.set("next", safeReturnPath(new URL(request.url).searchParams.get("next")));
    const { data, error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback.toString() } });
    if (error || !data.url) throw new Error("OAuth unavailable");
    return NextResponse.json({ url: data.url });
  } catch { return NextResponse.json({ error: "Authentication unavailable" }, { status: 503 }); }
}
