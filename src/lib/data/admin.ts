import { getSupabaseServiceClient } from "@/lib/supabase/server";

export interface AdminStats {
  ordersToday: number;
  revenueMonth: number;
  activeProducts: number;
  lowStock: number;
  pendingCustomerTypeRequests: number;
  pendingFulfillmentOrders: number;
  commerceBlockers: number;
  recentOrders: {
    id: string;
    order_number: string;
    customer_name: string;
    grand_total: number;
    payment_status: string;
    fulfillment_status: string;
    created_at: string;
  }[];
}

/** Aggregate stats for the admin dashboard. Uses the service role (bypasses RLS). */
export async function getAdminStats(): Promise<AdminStats | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [today, monthPaid, active, low, recent, pendingTypes, pendingFulfillment, invalidRules, unavailablePrices] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfDay.toISOString()),
    supabase
      .from("orders")
      .select("grand_total")
      .eq("payment_status", "paid")
      .gte("created_at", startOfMonth.toISOString()),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .lte("stock", 10),
    supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, grand_total, payment_status, fulfillment_status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("customer_type_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("fulfillment_status", "pending"),
    supabase.from("commerce_quantity_rules").select("id", { count: "exact", head: true }).eq("is_active", true).is("archived_at", null).or("minimum_quantity.lte.0,quantity_increment.lte.0"),
    supabase.from("variant_packaging_units").select("id,price_list_items!left(id)", { count: "exact", head: true }).eq("is_active", true).eq("is_sellable", true).is("archived_at", null).is("price_list_items.id", null),
  ]);

  const revenueMonth =
    monthPaid.data?.reduce((sum, r) => sum + Number(r.grand_total ?? 0), 0) ?? 0;

  return {
    ordersToday: today.count ?? 0,
    revenueMonth,
    activeProducts: active.count ?? 0,
    lowStock: low.count ?? 0,
    pendingCustomerTypeRequests: pendingTypes.count ?? 0,
    pendingFulfillmentOrders: pendingFulfillment.count ?? 0,
    commerceBlockers: (invalidRules.count ?? 0) + (unavailablePrices.count ?? 0),
    recentOrders: (recent.data ?? []) as AdminStats["recentOrders"],
  };
}
