"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, RefreshCw, Send, Truck } from "lucide-react";
import { useToast } from "@/components/admin/toast";
import type { BostaShipment } from "@/lib/bosta";
import { getBostaStateMeta } from "@/lib/bosta-status";
import { cn } from "@/lib/utils";

export function BostaShipmentPanel({
  orderId,
  initialShipment,
  configured,
  blocked = false,
  lang,
}: {
  orderId: string;
  initialShipment: BostaShipment | null;
  configured: boolean;
  blocked?: boolean;
  lang: "en" | "ar";
}) {
  const ar = lang === "ar";
  const router = useRouter();
  const toast = useToast();
  const [shipment, setShipment] = useState(initialShipment);
  const [loading, setLoading] = useState(false);
  const meta = shipment ? getBostaStateMeta(shipment.stateCode) : null;

  async function runAction(action: "create" | "sync") {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/orders/bosta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, action }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : "Bosta action failed");
      setShipment(result.data?.bosta ?? null);
      toast.success(
        action === "create"
          ? ar ? "تم إنشاء شحنة Bosta." : "Bosta shipment created."
          : ar ? "تم تحديث حالة الشحنة." : "Shipment status updated.",
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bosta action failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><Truck size={18} /></span>
          <div>
            <h2 className="text-sm font-bold text-fg">Bosta Shipping</h2>
            <p className="text-xs text-fg-dim">{ar ? "الشحن والتتبع" : "Shipment and tracking"}</p>
          </div>
        </div>
        {shipment && meta ? (
          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", toneClasses[meta.tone])}>
            {ar ? meta.labelAr : meta.labelEn}
          </span>
        ) : null}
      </div>

      {blocked && !shipment ? <p className="mt-3 text-sm text-fg-dim">{ar ? "الطلب مربوط بشحنة Mylerz بالفعل." : "This order already has a Mylerz shipment."}</p> : null}
      {!configured ? (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
          {ar ? "أضف BOSTA_API_KEY وBOSTA_WEBHOOK_SECRET ورابط الموقع العام لتفعيل الربط." : "Add BOSTA_API_KEY, BOSTA_WEBHOOK_SECRET, and the public site URL to activate Bosta."}
        </p>
      ) : null}

      {shipment ? (
        <div className="mt-4 space-y-3">
          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            <Info label={ar ? "رقم التتبع" : "Tracking number"} value={shipment.trackingNumber} ltr />
            <Info label={ar ? "آخر تحديث" : "Last update"} value={new Date(shipment.stateUpdatedAt).toLocaleString(ar ? "ar-EG" : "en-GB")} />
            <Info label={ar ? "حالة Bosta" : "Bosta state"} value={shipment.stateValue ?? meta?.value ?? "-"} ltr />
            <Info label={ar ? "محاولات التسليم" : "Delivery attempts"} value={String(shipment.numberOfAttempts ?? 0)} />
            {shipment.deliveryPromiseDate ? <Info label={ar ? "التسليم المتوقع" : "Promised delivery"} value={shipment.deliveryPromiseDate} ltr /> : null}
            {shipment.pickup ? <Info label={ar ? "موعد الاستلام" : "Pickup date"} value={`${shipment.pickup.scheduledDate}${shipment.pickup.scheduledTimeSlot ? ` · ${shipment.pickup.scheduledTimeSlot}` : ""}`} /> : null}
          </dl>
          {shipment.exceptionReason ? (
            <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              <strong>{ar ? "سبب التعذر: " : "Exception: "}</strong>{shipment.exceptionReason}
            </p>
          ) : null}
          {shipment.timeline?.length ? (
            <ol className="space-y-2 border-t border-border pt-3">
              {shipment.timeline.slice(-5).map((step, index) => (
                <li key={`${step.value}-${index}`} className="flex gap-2 text-xs">
                  <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", step.done ? "bg-emerald-500" : "bg-slate-300")} />
                  <div><p className="font-medium text-fg" dir="ltr">{step.value}</p>{step.nextAction ? <p className="text-fg-dim" dir="ltr">{step.nextAction}</p> : null}</div>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-fg-dim">
          {ar ? "أنشئ الشحنة بعد تأكيد وتجهيز الطلب ليظهر رقم التتبع وتصل تحديثات Bosta تلقائيًا." : "Create the shipment after confirming the order to receive tracking and automatic status updates."}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading || !configured || (blocked && !shipment)}
          onClick={() => void runAction(shipment ? "sync" : "create")}
          className="btn btn-primary px-4"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : shipment ? <RefreshCw size={16} /> : <Send size={16} />}
          {loading
            ? ar ? "جارٍ الاتصال..." : "Connecting..."
            : shipment
              ? ar ? "تحديث من Bosta" : "Sync from Bosta"
              : ar ? "إنشاء شحنة" : "Create shipment"}
        </button>
        {shipment ? (
          <a href={`/api/admin/orders/bosta/awb?id=${encodeURIComponent(orderId)}`} className="btn btn-secondary px-4">
            <Download size={16} />
            {ar ? "تنزيل AWB" : "Download AWB"}
          </a>
        ) : null}
      </div>
    </section>
  );
}

const toneClasses = {
  neutral: "bg-slate-100 text-slate-700",
  info: "bg-sky-50 text-sky-700",
  warning: "bg-amber-50 text-amber-800",
  success: "bg-emerald-50 text-emerald-700",
  danger: "bg-red-50 text-red-700",
};

function Info({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return <div><dt className="text-fg-dim">{label}</dt><dd className="mt-0.5 font-semibold text-fg" dir={ltr ? "ltr" : undefined}>{value}</dd></div>;
}
