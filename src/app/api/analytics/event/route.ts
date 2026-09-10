import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const EventSchema = z.object({
  visitorId: z.string().uuid(),
  eventType: z.enum(["page_view", "add_to_cart", "initiate_checkout"]),
  path: z.string().startsWith("/").max(500),
});

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = EventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid analytics event" }, { status: 422 });
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) return new NextResponse(null, { status: 204 });

  const { error } = await supabase.from("store_events").insert({
    visitor_id: parsed.data.visitorId,
    event_type: parsed.data.eventType,
    path: parsed.data.path,
  });

  if (error) {
    console.error("Could not store analytics event:", error.message);
  }

  return new NextResponse(null, { status: 204 });
}
