import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { PriceGrid } from "@/components/admin/price-grid";
import { getLang } from "@/lib/i18n/server";
import { getPriceList, listPriceListItems } from "@/lib/pricing/commands";

export default async function PriceListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lang, list, items] = await Promise.all([getLang(), getPriceList(id).catch(() => null), listPriceListItems(id).catch(() => [])]);
  if (!list) notFound();
  const ar = lang === "ar";
  return <div><AdminPageHeader eyebrow={ar ? "قائمة أسعار" : "Price List"} title={ar ? list.name_ar : list.name_en} description={`${list.code} · EGP`}/><div className="mt-6"><PriceGrid listId={id} items={items as never[]} lang={lang}/></div></div>;
}
