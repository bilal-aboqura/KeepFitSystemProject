import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function safePath(value: string | null) { return value?.startsWith("/") && !value.startsWith("//") ? value : "/account"; }
export async function POST(request: NextRequest) {
  const sb = await getSupabaseServerClient();
  if (!sb) return NextResponse.json({ error: "Authentication is unavailable." }, { status: 503 });
  const next = safePath(new URL(request.url).searchParams.get("next"));
  const redirectTo = new URL("/auth/callback", request.url);
  redirectTo.searchParams.set("next", next);
  const { data, error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo.toString() } });
  if (error || !data.url) return NextResponse.json({ error: "Could not start Google sign-in." }, { status: 502 });
  return NextResponse.json({ url: data.url });
}
