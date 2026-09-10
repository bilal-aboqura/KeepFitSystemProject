import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export async function claimShipmentCreation(
  id: string,
  carrier: "mylerz" | "bosta",
) {
  const sb = getSupabaseServiceClient();
  if (!sb) throw new Error("DB unavailable");
  const { data, error } = await sb
    .from("orders")
    .update({ shipment_creation: carrier })
    .eq("id", id)
    .is("shipment_creation", null)
    .is("mylerz", null)
    .is("bosta", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function releaseShipmentCreation(id: string) {
  const sb = getSupabaseServiceClient();
  if (!sb) throw new Error("DB unavailable");
  const { error } = await sb
    .from("orders")
    .update({ shipment_creation: null })
    .eq("id", id);
  if (error) throw error;
}
