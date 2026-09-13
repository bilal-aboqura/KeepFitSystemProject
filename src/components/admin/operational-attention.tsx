import Link from "next/link";
import { AlertTriangle, ClipboardCheck, PackageCheck } from "lucide-react";

export function OperationalAttention({ pendingApprovals, pendingOrders, blockers, lang }: { pendingApprovals: number; pendingOrders: number; blockers: number; lang: "en" | "ar" }) {
  const ar = lang === "ar";
  const items = [
    { href: "/admin/customer-type-requests?status=pending", Icon: ClipboardCheck, count: pendingApprovals, label: ar ? "طلبات حساب تجاري معلقة" : "Pending commercial approvals" },
    { href: "/admin/orders?fulfillment=pending", Icon: PackageCheck, count: pendingOrders, label: ar ? "طلبات تنتظر التنفيذ" : "Orders awaiting fulfillment" },
    { href: "/admin/commerce/quantity-rules?blockers=1", Icon: AlertTriangle, count: blockers, label: ar ? "عوائق تجارة تحتاج ضبطًا" : "Commerce configuration blockers" },
  ];
  return <section className="mt-6"><h2 className="font-heading text-xl font-bold text-fg">{ar ? "يحتاج إلى انتباهك" : "Needs Your Attention"}</h2><div className="mt-3 grid gap-3 md:grid-cols-3">{items.map(({ href, Icon, count, label }) => <Link key={href} href={href} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4 transition hover:border-brand"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-800"><Icon size={20}/></span><span className="flex-1 text-sm font-semibold text-fg">{label}</span><strong className="text-2xl text-brand">{count}</strong></Link>)}</div></section>;
}
