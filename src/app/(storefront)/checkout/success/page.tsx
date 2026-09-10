import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getOrderByNumber } from "@/lib/data/orders";
import { buildOwnerWhatsAppUrl } from "@/lib/notifications";
import { getLang } from "@/lib/i18n/server";
import { formatPrice } from "@/lib/utils";
import { CheckCircle, Clock, MessageCircle, ArrowLeft, Package } from "lucide-react";
import { MetaPurchase } from "@/components/storefront/meta-purchase";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const sp = await searchParams;
  if (!sp.order) notFound();
  const [order, lang] = await Promise.all([getOrderByNumber(sp.order), getLang()]);
  if (!order) notFound();
  const ar = lang === "ar";

  const whatsapp = buildOwnerWhatsAppUrl(order);

  const isPaid = order.payment_status === "paid";
  const purchaseConfirmed = order.payment_method === "cod" || isPaid;

  return (
    <div className="mx-auto max-w-2xl px-5 py-14">
      {purchaseConfirmed && (
        <MetaPurchase
          orderNumber={order.order_number}
          value={Number(order.grand_total)}
          contents={order.order_items.map((item) => ({
            id: item.product_id,
            quantity: item.quantity,
            item_price: Number(item.price),
          }))}
        />
      )}

      <div className="glass-elevated p-8 text-center">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${isPaid || order.payment_method === "cod" ? "bg-emerald/10 text-emerald" : "bg-gold/10 text-gold"}`}>
          {isPaid || order.payment_method === "cod" ? <CheckCircle size={32} /> : <Clock size={32} />}
        </div>
        <h1 className="mt-5 font-heading text-3xl font-bold text-fg">
          {ar ? "تم استلام طلبك!" : "Order received!"}
        </h1>
        <p className="mt-2 text-fg-muted">
          {ar ? "رقم الطلب: " : "Order number: "}
          <span className="font-mono font-semibold text-fg">{order.order_number}</span>
        </p>
        <p className="mt-1 text-sm text-fg-dim">
          {order.payment_method === "card"
            ? isPaid ? (ar ? "تم الدفع بنجاح عبر البطاقة." : "Card payment successful.") : (ar ? "في انتظار تأكيد الدفع." : "Awaiting payment confirmation.")
            : ar ? "الدفع عند الاستلام. سنتواصل معك قريبا." : "Cash on Delivery. We'll contact you shortly."}
        </p>

        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noreferrer" className="btn btn-primary mt-6 gap-2">
            <MessageCircle size={16} />
            {ar ? "إرسال تفاصيل عبر واتساب" : "Send details via WhatsApp"}
          </a>
        )}
      </div>

      <div className="glass mt-6 p-6">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-fg-muted">
          <Package size={14} />
          {ar ? "تفاصيل الطلب" : "Order details"}
        </h2>
        <div className="mt-5 space-y-3">
          {order.order_items.map((i) => (
            <div key={i.id} className="flex items-center gap-3">
              {i.image && <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white"><Image src={i.image} alt={i.name_en} fill sizes="44px" className="object-contain p-1" /></div>}
              <div className="min-w-0 flex-1"><p className="line-clamp-1 text-sm text-fg">{ar ? (i.name_ar ?? i.name_en) : i.name_en}</p><p className="text-xs text-fg-dim">x{i.quantity}</p></div>
              <span className="text-sm font-medium text-fg">{formatPrice(Number(i.price) * i.quantity, lang)}</span>
            </div>
          ))}
        </div>

        <dl className="mt-6 space-y-2.5 border-t border-border pt-5 text-sm">
          <div className="flex justify-between"><dt className="text-fg-dim">{ar ? "المجموع الفرعي" : "Subtotal"}</dt><dd className="text-fg">{formatPrice(Number(order.items_total), lang)}</dd></div>
          <div className="flex justify-between"><dt className="text-fg-dim">{ar ? "الشحن" : "Shipping"}</dt><dd className="text-fg">{formatPrice(Number(order.shipping_cost), lang)}</dd></div>
          {Number(order.discount) > 0 && <div className="flex justify-between"><dt className="text-fg-dim">{ar ? "الخصم" : "Discount"}</dt><dd className="text-emerald">-{formatPrice(Number(order.discount), lang)}</dd></div>}
          <div className="flex justify-between border-t border-border pt-2.5"><dt className="font-semibold text-fg">{ar ? "الإجمالي" : "Total"}</dt><dd className="text-xl font-bold text-brand">{formatPrice(Number(order.grand_total), lang)}</dd></div>
        </dl>
      </div>

      <div className="glass mt-4 p-6 text-sm text-fg-dim">
        <p>{ar ? "العميل: " : "Customer: "}<span className="text-fg">{order.customer_name}</span> &middot; <span dir="ltr">{order.customer_phone}</span></p>
        <p className="mt-1">{ar ? "العنوان: " : "Address: "}<span className="text-fg">{order.address}, {order.city}, {order.governorate}</span></p>
      </div>

      <div className="mt-8 text-center">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand transition hover:underline">
          <ArrowLeft size={14} /> {ar ? "العودة للتسوق" : "Back to shopping"}
        </Link>
      </div>
    </div>
  );
}
