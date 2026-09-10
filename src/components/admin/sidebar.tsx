"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Tag,
  Truck,
  FileText,
  Palette,
  Settings,
  BarChart3,
  Layers,
  Mailbox,
  MessageSquareText,
} from "lucide-react";
import { useLang } from "@/components/language/provider";
import { cn } from "@/lib/utils";

type NavKey = "dashboard" | "analytics" | "products" | "orders" | "reviews" | "customers" | "newsletter" | "discounts" | "shipping" | "bundles" | "content" | "customize" | "settings";

interface NavItem {
  href: string;
  key: NavKey;
  Icon: typeof LayoutDashboard;
}

interface NavGroup {
  label: { en: string; ar: string };
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: { en: "Overview", ar: "نظرة عامة" },
    items: [
      { href: "/admin", key: "dashboard", Icon: LayoutDashboard },
      { href: "/admin/analytics", key: "analytics", Icon: BarChart3 },
    ],
  },
  {
    label: { en: "Commerce", ar: "التجارة" },
    items: [
      { href: "/admin/products", key: "products", Icon: Package },
      { href: "/admin/orders", key: "orders", Icon: ShoppingCart },
      { href: "/admin/reviews", key: "reviews", Icon: MessageSquareText },
      { href: "/admin/customers", key: "customers", Icon: Users },
      { href: "/admin/newsletter", key: "newsletter", Icon: Mailbox },
    ],
  },
  {
    label: { en: "Configuration", ar: "الإعدادات" },
    items: [
      { href: "/admin/discounts", key: "discounts", Icon: Tag },
      { href: "/admin/shipping", key: "shipping", Icon: Truck },
      { href: "/admin/bundles", key: "bundles", Icon: Layers },
      { href: "/admin/content", key: "content", Icon: FileText },
      { href: "/admin/customize", key: "customize", Icon: Palette },
      { href: "/admin/settings", key: "settings", Icon: Settings },
    ],
  },
];

function getNavLabel(key: NavKey, t: Record<string, string>, ar: boolean): string {
  if (key === "analytics") return ar ? "التحليلات" : "Analytics";
  if (key === "customize") return ar ? "التخصيص" : "Customize";
  if (key === "bundles") return ar ? "الباكدجات" : "Bundles";
  if (key === "newsletter") return t.newsletter;
  return t[key];
}

export function AdminSidebar() {
  const { t, lang } = useLang();
  const pathname = usePathname();
  const ar = lang === "ar";

  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-[96px] lg:w-[280px]">
      <div className="rounded-2xl border border-border bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <div className="hidden rounded-2xl border border-slate-200 bg-slate-50/80 p-4 lg:block">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-dim">
          {ar ? "لوحة التحكم" : "Control Center"}
        </p>
        <p className="mt-2 text-sm font-medium text-fg">
          {ar ? "إدارة الطلبات والمنتجات والمحتوى من مكان واحد." : "Manage orders, products, and storefront content from one place."}
        </p>
      </div>

      <nav className="hidden lg:mt-4 lg:flex lg:flex-col lg:gap-1.5">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && <div className="my-3 border-t border-border" />}
            <p className="mb-1.5 px-3 pt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-dim">
              {ar ? group.label.ar : group.label.en}
            </p>
            {group.items.map(({ href, key, Icon }) => {
              const active =
                href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition",
                    active
                      ? "bg-brand text-white shadow-sm shadow-brand/20"
                      : "text-fg-dim hover:bg-slate-50 hover:text-fg",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg",
                      active ? "bg-white/14 text-white" : "bg-slate-100 text-fg-muted",
                    )}
                  >
                    <Icon size={16} />
                  </span>
                  <span className="truncate">{getNavLabel(key, t.admin, ar)}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="relative lg:hidden">
        <nav className="flex gap-2 overflow-x-auto px-0 scrollbar-none">
          {NAV_GROUPS.flatMap((group) => group.items).map(({ href, key, Icon }) => {
            const active =
              href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "border-brand bg-brand text-white shadow-sm shadow-brand/20"
                    : "border-border bg-white text-fg-dim hover:text-fg",
                )}
              >
                <Icon size={16} />
                <span>{getNavLabel(key, t.admin, ar)}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      </div>
    </aside>
  );
}
