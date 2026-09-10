import { getAnalytics } from "@/lib/data/analytics";
import { getLang } from "@/lib/i18n/server";
import { formatPrice } from "@/lib/utils";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  MapPin,
  CreditCard,
  BarChart3,
  Eye,
  MousePointerClick,
} from "lucide-react";

export default async function AnalyticsPage() {
  const lang = await getLang();
  const ar = lang === "ar";
  const analytics = await getAnalytics();

  if (!analytics) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="glass p-8 text-center">
          <BarChart3 size={40} className="mx-auto text-fg-dim" />
          <p className="mt-4 text-fg-dim">
            {ar
              ? "لا يمكن تحميل التحليلات. قاعدة البيانات غير متصلة."
              : "Unable to load analytics. Database not connected."}
          </p>
        </div>
      </div>
    );
  }

  const maxRevenue = Math.max(...analytics.dailyRevenue.map((d) => d.revenue), 1);
  const maxStatus = Math.max(...analytics.statusBreakdown.map((s) => s.count), 1);
  const maxPayment = Math.max(...analytics.paymentBreakdown.map((p) => p.count), 1);
  const maxTraffic = Math.max(
    ...analytics.dailyTraffic.map((day) => day.pageViews),
    1,
  );
  const repeatRate =
    analytics.totalCustomers > 0
      ? Math.round((analytics.repeatCustomers / analytics.totalCustomers) * 100)
      : 0;
  const visitorConversion =
    analytics.visitorsMonth > 0
      ? ((analytics.ordersMonth / analytics.visitorsMonth) * 100).toFixed(1)
      : "0.0";

  const kpis = [
    {
      Icon: DollarSign,
      label: ar ? "إيرادات الشهر" : "Monthly Revenue",
      value: formatPrice(analytics.revenueMonth, lang),
      hint: ar
        ? `اليوم: ${formatPrice(analytics.revenueToday, lang)}`
        : `Today: ${formatPrice(analytics.revenueToday, lang)}`,
      color: "text-emerald-400",
    },
    {
      Icon: ShoppingCart,
      label: ar ? "طلبات الشهر" : "Monthly Orders",
      value: String(analytics.ordersMonth),
      hint: ar
        ? `اليوم: ${analytics.ordersToday} · الأسبوع: ${analytics.ordersWeek}`
        : `Today: ${analytics.ordersToday} · Week: ${analytics.ordersWeek}`,
      color: "text-brand",
    },
    {
      Icon: TrendingUp,
      label: ar ? "متوسط قيمة الطلب" : "Avg Order Value",
      value: formatPrice(analytics.avgOrderValue, lang),
      hint: ar
        ? `إجمالي: ${formatPrice(analytics.revenueTotal, lang)}`
        : `Total: ${formatPrice(analytics.revenueTotal, lang)}`,
      color: "text-stargold",
    },
    {
      Icon: Users,
      label: ar ? "إجمالي العملاء" : "Total Customers",
      value: String(analytics.totalCustomers),
      hint: ar
        ? `عملاء متكررين: ${analytics.repeatCustomers}`
        : `Repeat: ${analytics.repeatCustomers}`,
      color: "text-violet-400",
    },
  ];

  const trafficKpis = [
    {
      Icon: Users,
      label: ar ? "زوار اليوم" : "Visitors today",
      value: String(analytics.visitorsToday),
      hint: ar ? "زوار مميزون" : "Unique visitors",
      color: "text-sky-600",
    },
    {
      Icon: Users,
      label: ar ? "زوار هذا الشهر" : "Visitors this month",
      value: String(analytics.visitorsMonth),
      hint: ar ? `الإجمالي: ${analytics.visitorsTotal}` : `All time: ${analytics.visitorsTotal}`,
      color: "text-violet-600",
    },
    {
      Icon: Eye,
      label: ar ? "مشاهدات اليوم" : "Page views today",
      value: String(analytics.pageViewsToday),
      hint: ar ? "زيارات الصفحات" : "Page visits",
      color: "text-brand",
    },
    {
      Icon: MousePointerClick,
      label: ar ? "بدء الدفع هذا الشهر" : "Checkout starts",
      value: String(analytics.checkoutStartsMonth),
      hint: ar ? `إضافة للسلة: ${analytics.addToCartsMonth}` : `Added to cart: ${analytics.addToCartsMonth}`,
      color: "text-emerald-600",
    },
  ];

  const statusColors: Record<string, string> = {
    delivered: "bg-emerald-500",
    shipped: "bg-sky-500",
    processing: "bg-amber-500",
    pending: "bg-amber-400",
    cancelled: "bg-red-500",
    returned: "bg-orange-500",
    refunded: "bg-zinc-500",
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-fg">
          {ar ? "التحليلات" : "Analytics"}
        </h1>
        <p className="mt-1 text-sm text-fg-dim">
          {ar
            ? "نظرة شاملة على أداء المتجر"
            : "Comprehensive overview of store performance"}
        </p>
      </div>

      <section aria-labelledby="traffic-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="traffic-heading" className="font-heading text-lg font-bold text-fg">
              {ar ? "حركة الموقع" : "Website traffic"}
            </h2>
            <p className="mt-1 text-sm text-fg-dim">
              {ar
                ? "زيارات مجهولة المصدر وسلوك التسوق من آخر 30 يومًا"
                : "Anonymous visits and shopping activity from the last 30 days"}
            </p>
          </div>
          <p className="text-sm font-medium text-fg-muted">
            {ar ? "تحويل الزوار هذا الشهر: " : "Visitor conversion this month: "}
            <span className="font-semibold text-brand">{visitorConversion}%</span>
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {trafficKpis.map((kpi) => (
            <div key={kpi.label} className="glass p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-fg-muted">{kpi.label}</p>
                <kpi.Icon size={17} className={kpi.color} />
              </div>
              <p className="mt-3 font-heading text-3xl font-bold tabular-nums text-fg">
                {kpi.value}
              </p>
              <p className="mt-1 text-xs text-fg-dim">{kpi.hint}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
          <div className="glass p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-fg">
                  {ar ? "نشاط الزوار" : "Visitor activity"}
                </h3>
                <p className="mt-0.5 text-xs text-fg-dim">
                  {ar ? "مشاهدات الصفحات يوميًا" : "Daily page views"}
                </p>
              </div>
              <span className="pill pill-neutral">30 {ar ? "يوم" : "days"}</span>
            </div>
            <div className="flex h-36 items-end gap-1" role="img" aria-label={ar ? "مخطط مشاهدات الصفحات اليومية" : "Daily page views chart"}>
              {analytics.dailyTraffic.map((day) => (
                <div key={day.date} className="group flex h-full min-w-0 flex-1 items-end" title={`${day.date}: ${day.visitors} ${ar ? "زائر" : "visitors"} · ${day.pageViews} ${ar ? "مشاهدة" : "views"}`}>
                  <div
                    className="w-full rounded-t bg-brand/80 transition-colors duration-200 group-hover:bg-brand"
                    style={{
                      height: `${(day.pageViews / maxTraffic) * 100}%`,
                      minHeight: day.pageViews > 0 ? "3px" : "0",
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-fg-dim">
              {analytics.dailyTraffic.filter((_, index) => index % 5 === 0).map((day) => (
                <span key={day.date}>{day.date}</span>
              ))}
            </div>
          </div>

          <div className="glass p-5">
            <h3 className="font-semibold text-fg">
              {ar ? "مسار الشراء هذا الشهر" : "Purchase path this month"}
            </h3>
            <div className="mt-4 divide-y divide-border">
              {[
                [ar ? "زوار مميزون" : "Unique visitors", analytics.visitorsMonth],
                [ar ? "إضافة إلى السلة" : "Added to cart", analytics.addToCartsMonth],
                [ar ? "بدء الدفع" : "Checkout starts", analytics.checkoutStartsMonth],
                [ar ? "طلبات" : "Orders", analytics.ordersMonth],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between py-3 text-sm">
                  <span className="text-fg-muted">{label}</span>
                  <span className="font-semibold tabular-nums text-fg">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass mt-4 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h3 className="font-semibold text-fg">{ar ? "أكثر الصفحات زيارة" : "Most visited pages"}</h3>
              <p className="mt-0.5 text-xs text-fg-dim">{ar ? "آخر 30 يومًا" : "Last 30 days"}</p>
            </div>
          </div>
          {analytics.popularPages.length === 0 ? (
            <p className="border-t border-border px-5 py-5 text-sm text-fg-dim">
              {ar ? "ستظهر بيانات الزيارات هنا بعد أول زيارة للموقع." : "Visit data will appear here after the first website visit."}
            </p>
          ) : (
            <div className="border-t border-border">
              {analytics.popularPages.map((page) => (
                <div key={page.path} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <code className="min-w-0 truncate text-fg-muted">{page.path}</code>
                  <span className="shrink-0 font-semibold tabular-nums text-fg">{page.views} {ar ? "مشاهدة" : "views"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* KPI Cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="glass p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-widest text-fg-dim">
                {kpi.label}
              </p>
              <kpi.Icon size={16} className={kpi.color} />
            </div>
            <p className="mt-3 font-heading text-3xl font-bold text-fg">
              {kpi.value}
            </p>
            <p className="mt-1 text-xs text-fg-dim">{kpi.hint}</p>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="glass mt-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-fg-muted">
            {ar ? "الإيرادات اليومية (آخر 30 يوم)" : "Daily Revenue (Last 30 Days)"}
          </h2>
          <p className="text-xs text-fg-dim">
            {ar ? "مرّر للتفاصيل" : "Hover for details"}
          </p>
        </div>
        <div className="flex items-end gap-1" style={{ height: "200px" }}>
          {analytics.dailyRevenue.map((d) => (
            <div
              key={d.date}
              className="flex-1 rounded-t bg-brand/80 transition hover:bg-brand"
              style={{
                height: `${(d.revenue / maxRevenue) * 100}%`,
                minHeight: d.revenue > 0 ? "2px" : "0",
              }}
              title={`${d.date}: ${formatPrice(d.revenue, lang)} (${d.orders} ${ar ? "طلب" : "orders"})`}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-fg-dim">
          {analytics.dailyRevenue
            .filter((_, i) => i % 5 === 0)
            .map((d) => (
              <span key={d.date}>{d.date}</span>
            ))}
        </div>
      </div>

      {/* Top Products & Top Cities */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Top Products */}
        <div className="glass p-6">
          <div className="mb-4 flex items-center gap-2">
            <Package size={16} className="text-brand" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-fg-muted">
              {ar ? "أفضل المنتجات" : "Top Products"}
            </h2>
          </div>
          {analytics.topProducts.length === 0 ? (
            <p className="text-sm text-fg-dim">
              {ar ? "لا توجد بيانات بعد." : "No data yet."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-fg-dim">
                  <tr>
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">{ar ? "المنتج" : "Product"}</th>
                    <th className="py-2 pr-3 text-right">{ar ? "الكمية" : "Qty"}</th>
                    <th className="py-2 text-right">{ar ? "الإيرادات" : "Revenue"}</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topProducts.map((p, i) => (
                    <tr key={p.name_en} className="border-t border-border">
                      <td className="py-2 pr-3 text-fg-dim">{i + 1}</td>
                      <td className="py-2 pr-3 text-fg">
                        <div>{ar ? p.name_ar : p.name_en}</div>
                        <div className="text-[10px] text-fg-dim">
                          {ar ? p.name_en : p.name_ar}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-fg-muted">
                        {p.quantity}
                      </td>
                      <td className="py-2 text-right font-semibold text-brand">
                        {formatPrice(p.revenue, lang)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Cities */}
        <div className="glass p-6">
          <div className="mb-4 flex items-center gap-2">
            <MapPin size={16} className="text-brand" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-fg-muted">
              {ar ? "أفضل المدن" : "Top Cities"}
            </h2>
          </div>
          {analytics.topCities.length === 0 ? (
            <p className="text-sm text-fg-dim">
              {ar ? "لا توجد بيانات بعد." : "No data yet."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-fg-dim">
                  <tr>
                    <th className="py-2 pr-3">{ar ? "المدينة" : "City"}</th>
                    <th className="py-2 pr-3 text-right">
                      {ar ? "الطلبات" : "Orders"}
                    </th>
                    <th className="py-2 text-right">{ar ? "الإيرادات" : "Revenue"}</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topCities.map((c) => (
                    <tr key={`${c.city}-${c.governorate}`} className="border-t border-border">
                      <td className="py-2 pr-3 text-fg">
                        <div>{c.city}</div>
                        <div className="text-[10px] text-fg-dim">{c.governorate}</div>
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-fg-muted">
                        {c.orders}
                      </td>
                      <td className="py-2 text-right font-semibold text-brand">
                        {formatPrice(c.revenue, lang)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Status, Payment, Customer Metrics */}
      <div className="mt-6 grid gap-6 md:grid-cols-3">
        {/* Order Status Breakdown */}
        <div className="glass p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-fg-muted">
            {ar ? "حالة الطلبات" : "Order Status"}
          </h2>
          <div className="space-y-3">
            {analytics.statusBreakdown.map((s) => (
              <div key={s.status}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="capitalize text-fg">{s.status}</span>
                  <span className="font-mono text-fg-dim">{s.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full ${statusColors[s.status] ?? "bg-zinc-500"}`}
                    style={{ width: `${(s.count / maxStatus) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="glass p-6">
          <div className="mb-4 flex items-center gap-2">
            <CreditCard size={16} className="text-brand" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-fg-muted">
              {ar ? "طرق الدفع" : "Payment Methods"}
            </h2>
          </div>
          <div className="space-y-3">
            {analytics.paymentBreakdown.map((p) => {
              const pct =
                analytics.ordersTotal > 0
                  ? Math.round((p.count / analytics.ordersTotal) * 100)
                  : 0;
              return (
                <div key={p.method}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="uppercase text-fg">{p.method}</span>
                    <span className="text-fg-dim">
                      {pct}% · {formatPrice(p.revenue, lang)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${(p.count / maxPayment) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Customer Metrics */}
        <div className="glass p-6">
          <div className="mb-4 flex items-center gap-2">
            <Users size={16} className="text-brand" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-fg-muted">
              {ar ? "مقاييس العملاء" : "Customer Metrics"}
            </h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-fg-dim">
                {ar ? "إجمالي العملاء" : "Total Customers"}
              </span>
              <span className="font-heading text-xl font-bold text-fg">
                {analytics.totalCustomers}
              </span>
            </div>
            <div className="border-t border-border" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-fg-dim">
                {ar ? "عملاء متكررين" : "Repeat Customers"}
              </span>
              <span className="font-heading text-xl font-bold text-fg">
                {analytics.repeatCustomers}
              </span>
            </div>
            <div className="border-t border-border" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-fg-dim">
                {ar ? "عملاء جدد هذا الشهر" : "New This Month"}
              </span>
              <span className="font-heading text-xl font-bold text-fg">
                {analytics.newCustomersThisMonth}
              </span>
            </div>
            <div className="border-t border-border" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-fg-dim">
                {ar ? "معدل التكرار" : "Repeat Rate"}
              </span>
              <span className="font-heading text-xl font-bold text-brand">
                {repeatRate}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
