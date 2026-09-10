import Image from "next/image";
import Link from "next/link";
import { Plus, Star } from "lucide-react";
import { adminListProducts } from "@/lib/data/admin-crud";
import { getAllCategories } from "@/lib/data/catalog";
import { getLang } from "@/lib/i18n/server";
import { formatPrice } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSectionCard } from "@/components/admin/section-card";
import { AdminStatCard } from "@/components/admin/stat-card";

export default async function AdminProductsPage() {
  const lang = await getLang();
  const ar = lang === "ar";
  const [products, categories] = await Promise.all([
    adminListProducts(),
    getAllCategories(),
  ]);

  const activeCount = products.filter((product) => product.is_active).length;
  const featuredCount = products.filter((product) => product.is_featured).length;
  const lowStockCount = products.filter((product) => product.stock <= 10).length;

  return (
    <div>
      <AdminPageHeader
        eyebrow={ar ? "الكتالوج" : "Catalog"}
        title={ar ? "المنتجات" : "Products"}
        description={
          ar
            ? "راجع المخزون بسرعة، تابع المنتجات المميزة، وافتح التعديل من نفس الشاشة."
            : "Review inventory quickly, track featured products, and jump into editing from one screen."
        }
        actions={
          <Link
            href="/admin/products/new"
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            <Plus size={16} />
            {ar ? "منتج جديد" : "New product"}
          </Link>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard icon={Plus} label={ar ? "إجمالي المنتجات" : "Total products"} value={products.length} hint={ar ? "كل المنتجات الحالية" : "all current products"} tone="brand" />
        <AdminStatCard icon={Star} label={ar ? "منتجات مميزة" : "Featured"} value={featuredCount} hint={ar ? "معروضة في الواجهة" : "shown on the storefront"} tone="gold" />
        <AdminStatCard icon={Star} label={ar ? "منتجات نشطة" : "Active"} value={activeCount} hint={ar ? "متاحة للبيع" : "available for sale"} tone="success" />
        <AdminStatCard icon={Star} label={ar ? "مخزون منخفض" : "Low stock"} value={lowStockCount} hint={ar ? "10 قطع أو أقل" : "10 units or less"} tone="violet" />
      </div>

      <AdminSectionCard
        className="mt-6"
        title={ar ? "قائمة المنتجات" : "Product list"}
        description={
          ar ? "كل المنتجات مرتبة مع السعر، المخزون، والحالة." : "All products with price, stock, and publish state."
        }
        contentClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-fg-dim">
              <tr>
                <th className="px-5 py-4 sm:px-6">{ar ? "المنتج" : "Product"}</th>
                <th className="px-5 py-4 sm:px-6">{ar ? "الفئة" : "Category"}</th>
                <th className="px-5 py-4 sm:px-6">{ar ? "السعر" : "Price"}</th>
                <th className="px-5 py-4 sm:px-6">{ar ? "المخزون" : "Stock"}</th>
                <th className="px-5 py-4 sm:px-6">{ar ? "الحالة" : "Status"}</th>
                <th className="px-5 py-4 text-right sm:px-6">{ar ? "إجراء" : "Action"}</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-fg-dim sm:px-6">
                    {ar ? "لا توجد منتجات بعد." : "No products yet."}
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const category = categories.find((item) => item.id === product.category_id);
                  return (
                    <tr key={product.id} className="border-b border-border/80 transition hover:bg-slate-50">
                      <td className="px-5 py-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          {product.images?.[0] ? (
                            <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-border bg-white">
                              <Image
                                src={product.images[0]}
                                alt=""
                                fill
                                sizes="48px"
                                className="object-contain p-1"
                              />
                            </div>
                          ) : null}
                          <div className="min-w-0">
                            <div className="truncate font-medium text-fg">
                              {ar ? product.name_ar : product.name_en}
                            </div>
                            <div className="text-xs text-fg-dim">
                              {product.sku ?? product.legacy_id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-fg-muted sm:px-6">
                        {category ? (ar ? category.name_ar : category.name_en) : "-"}
                      </td>
                      <td className="px-5 py-4 font-semibold text-brand sm:px-6">
                        {formatPrice(Number(product.price), lang)}
                      </td>
                      <td className="px-5 py-4 sm:px-6">
                        <span className={product.stock <= 10 ? "font-semibold text-red-500" : "text-fg"}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="px-5 py-4 sm:px-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={
                              product.is_active
                                ? "pill pill-success"
                                : "pill pill-neutral"
                            }
                          >
                            {product.is_active ? (ar ? "نشط" : "Active") : ar ? "مخفي" : "Hidden"}
                          </span>
                          {product.is_featured ? (
                            <span className="pill bg-amber-50 text-amber-700">
                              <Star size={10} />
                              {ar ? "مميز" : "Featured"}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right sm:px-6">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="inline-flex rounded-lg px-2 py-1 text-sm font-medium text-brand transition hover:bg-red-50"
                        >
                          {ar ? "تعديل" : "Edit"}
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </AdminSectionCard>
    </div>
  );
}
