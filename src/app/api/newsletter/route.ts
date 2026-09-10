import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const Schema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
});

export async function POST(request: Request) {
  const sb = getSupabaseServiceClient();
  if (!sb) {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 422 });
  }

  const { email } = parsed.data;

  const { data: existing, error: readError } = await sb
    .from("newsletter_subscribers")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 400 });
  }

  if (existing) {
    return NextResponse.json({ ok: true, status: "exists" });
  }

  const { error } = await sb.from("newsletter_subscribers").insert({ email });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, status: "subscribed" });
}
