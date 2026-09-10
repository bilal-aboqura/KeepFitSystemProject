import { getSupabaseServiceClient } from "@/lib/supabase/server";

export interface AnalyticsData {
  revenueToday: number;
  revenueWeek: number;
  revenueMonth: number;
  revenueTotal: number;

  ordersToday: number;
  ordersWeek: number;
  ordersMonth: number;
  ordersTotal: number;

  avgOrderValue: number;

  dailyRevenue: { date: string; revenue: number; orders: number }[];

  statusBreakdown: { status: string; count: number }[];

  paymentBreakdown: { method: string; count: number; revenue: number }[];

  topProducts: {
    name_en: string;
    name_ar: string;
    quantity: number;
    revenue: number;
  }[];

  topCities: {
    city: string;
    governorate: string;
    orders: number;
    revenue: number;
  }[];

  totalCustomers: number;
  repeatCustomers: number;
  newCustomersThisMonth: number;

  visitorsToday: number;
  visitorsMonth: number;
  visitorsTotal: number;
  pageViewsToday: number;
  addToCartsMonth: number;
  checkoutStartsMonth: number;
  dailyTraffic: { date: string; visitors: number; pageViews: number }[];
  popularPages: { path: string; views: number }[];
}

function startOfDay(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfWeek(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d.toISOString();
}

function startOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function start30DaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function formatDateLabel(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${m}/${d}`;
}

function dateKey(iso: string): string {
  const d = new Date(iso);
  return formatDateLabel(d);
}

export async function getAnalytics(): Promise<AnalyticsData | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;

  const [ordersRes, itemsRes, eventsRes] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, customer_phone, governorate, city, grand_total, payment_method, payment_status, fulfillment_status, created_at",
      ),
    supabase
      .from("order_items")
      .select("name_en, name_ar, price, quantity, order_id"),
    supabase
      .from("store_events")
      .select("visitor_id, event_type, path, created_at"),
  ]);

  const orders = ordersRes.data ?? [];
  const items = itemsRes.data ?? [];
  const events = eventsRes.data ?? [];

  const todayISO = startOfDay();
  const weekISO = startOfWeek();
  const monthISO = startOfMonth();
  const thirtyDaysISO = start30DaysAgo();

  const paidOrders = orders.filter(
    (o) => o.payment_status === "paid" || o.payment_status === "pending",
  );

  const revenueToday = paidOrders
    .filter((o) => o.created_at >= todayISO)
    .reduce((s, o) => s + Number(o.grand_total), 0);
  const revenueWeek = paidOrders
    .filter((o) => o.created_at >= weekISO)
    .reduce((s, o) => s + Number(o.grand_total), 0);
  const revenueMonth = paidOrders
    .filter((o) => o.created_at >= monthISO)
    .reduce((s, o) => s + Number(o.grand_total), 0);
  const revenueTotal = paidOrders.reduce(
    (s, o) => s + Number(o.grand_total),
    0,
  );

  const ordersToday = orders.filter((o) => o.created_at >= todayISO).length;
  const ordersWeek = orders.filter((o) => o.created_at >= weekISO).length;
  const ordersMonth = orders.filter((o) => o.created_at >= monthISO).length;
  const ordersTotal = orders.length;

  const avgOrderValue =
    paidOrders.length > 0 ? Math.round(revenueTotal / paidOrders.length) : 0;

  // Daily revenue for last 30 days
  const dailyMap = new Map<string, { revenue: number; orders: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dailyMap.set(formatDateLabel(d), { revenue: 0, orders: 0 });
  }
  for (const o of paidOrders) {
    if (o.created_at >= thirtyDaysISO) {
      const key = dateKey(o.created_at);
      const entry = dailyMap.get(key);
      if (entry) {
        entry.revenue += Number(o.grand_total);
        entry.orders += 1;
      }
    }
  }
  const dailyRevenue = Array.from(dailyMap.entries()).map(([date, v]) => ({
    date,
    revenue: v.revenue,
    orders: v.orders,
  }));

  // Status breakdown
  const statusMap = new Map<string, number>();
  for (const o of orders) {
    const s = o.fulfillment_status ?? "unknown";
    statusMap.set(s, (statusMap.get(s) ?? 0) + 1);
  }
  const statusBreakdown = Array.from(statusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  // Payment method breakdown
  const paymentMap = new Map<string, { count: number; revenue: number }>();
  for (const o of orders) {
    const m = o.payment_method ?? "unknown";
    const entry = paymentMap.get(m) ?? { count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += Number(o.grand_total);
    paymentMap.set(m, entry);
  }
  const paymentBreakdown = Array.from(paymentMap.entries())
    .map(([method, v]) => ({ method, count: v.count, revenue: v.revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  // Top products
  const productMap = new Map<
    string,
    { name_en: string; name_ar: string; quantity: number; revenue: number }
  >();
  for (const item of items) {
    const key = item.name_en ?? "Unknown";
    const entry = productMap.get(key) ?? {
      name_en: item.name_en ?? "Unknown",
      name_ar: item.name_ar ?? "غير معروف",
      quantity: 0,
      revenue: 0,
    };
    entry.quantity += Number(item.quantity);
    entry.revenue += Number(item.price) * Number(item.quantity);
    productMap.set(key, entry);
  }
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  // Top cities
  const cityMap = new Map<
    string,
    { city: string; governorate: string; orders: number; revenue: number }
  >();
  for (const o of orders) {
    const key = `${o.city ?? ""}|${o.governorate ?? ""}`;
    const entry = cityMap.get(key) ?? {
      city: o.city ?? "—",
      governorate: o.governorate ?? "—",
      orders: 0,
      revenue: 0,
    };
    entry.orders += 1;
    entry.revenue += Number(o.grand_total);
    cityMap.set(key, entry);
  }
  const topCities = Array.from(cityMap.values())
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 10);

  // Customer metrics
  const phoneFirst = new Map<string, string>();
  const phoneCounts = new Map<string, number>();
  for (const o of orders) {
    const phone = o.customer_phone ?? "";
    if (!phone) continue;
    phoneCounts.set(phone, (phoneCounts.get(phone) ?? 0) + 1);
    const existing = phoneFirst.get(phone);
    if (!existing || o.created_at < existing) {
      phoneFirst.set(phone, o.created_at);
    }
  }
  const totalCustomers = phoneCounts.size;
  let repeatCustomers = 0;
  for (const count of phoneCounts.values()) {
    if (count > 1) repeatCustomers++;
  }
  let newCustomersThisMonth = 0;
  for (const firstOrder of phoneFirst.values()) {
    if (firstOrder >= monthISO) newCustomersThisMonth++;
  }

  const todayEvents = events.filter((event) => event.created_at >= todayISO);
  const monthEvents = events.filter((event) => event.created_at >= monthISO);
  const uniqueVisitors = (collection: typeof events) =>
    new Set(collection.map((event) => event.visitor_id)).size;

  const visitorsToday = uniqueVisitors(todayEvents);
  const visitorsMonth = uniqueVisitors(monthEvents);
  const visitorsTotal = uniqueVisitors(events);
  const pageViewsToday = todayEvents.filter(
    (event) => event.event_type === "page_view",
  ).length;
  const addToCartsMonth = monthEvents.filter(
    (event) => event.event_type === "add_to_cart",
  ).length;
  const checkoutStartsMonth = monthEvents.filter(
    (event) => event.event_type === "initiate_checkout",
  ).length;

  const trafficMap = new Map<string, { visitors: Set<string>; pageViews: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    trafficMap.set(formatDateLabel(d), { visitors: new Set(), pageViews: 0 });
  }
  for (const event of events) {
    if (event.created_at < thirtyDaysISO) continue;
    const entry = trafficMap.get(dateKey(event.created_at));
    if (!entry) continue;
    entry.visitors.add(event.visitor_id);
    if (event.event_type === "page_view") entry.pageViews++;
  }
  const dailyTraffic = Array.from(trafficMap.entries()).map(([date, value]) => ({
    date,
    visitors: value.visitors.size,
    pageViews: value.pageViews,
  }));

  const pageMap = new Map<string, number>();
  for (const event of monthEvents) {
    if (event.event_type !== "page_view") continue;
    pageMap.set(event.path, (pageMap.get(event.path) ?? 0) + 1);
  }
  const popularPages = Array.from(pageMap.entries())
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  return {
    revenueToday,
    revenueWeek,
    revenueMonth,
    revenueTotal,
    ordersToday,
    ordersWeek,
    ordersMonth,
    ordersTotal,
    avgOrderValue,
    dailyRevenue,
    statusBreakdown,
    paymentBreakdown,
    topProducts,
    topCities,
    totalCustomers,
    repeatCustomers,
    newCustomersThisMonth,
    visitorsToday,
    visitorsMonth,
    visitorsTotal,
    pageViewsToday,
    addToCartsMonth,
    checkoutStartsMonth,
    dailyTraffic,
    popularPages,
  };
}
