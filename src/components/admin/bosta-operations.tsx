"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DownloadCloud, Loader2, PackageCheck, Truck } from "lucide-react";
import { useToast } from "@/components/admin/toast";
import type { StoredBostaPickup } from "@/lib/bosta-pickups";

export function BostaOperations({
  configured,
  pickups,
  lang,
}: {
  configured: boolean;
  pickups: StoredBostaPickup[];
  lang: "en" | "ar";
}) {
  const ar = lang === "ar";
  const router = useRouter();
  const toast = useToast();
  const [action, setAction] = useState<"pickup" | "import" | null>(null);

  async function run(operation: "pickup" | "import") {
    setAction(operation);
    try {
      const response = await fetch(`/api/admin/orders/bosta/${operation}`, { method: "POST" });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : "Bosta operation failed");
      if (operation === "pickup") {
        const data = result.data;
        toast.success(
          data?.status === "scheduled"
            ? ar ? `تمت جدولة استلام ${data.orders} شحنات.` : `Pickup scheduled for ${data.orders} shipments.`
            : data?.status === "below-minimum"
              ? ar ? `يوجد ${data.readyOrders} طلبات جاهزة فقط؛ الحد الأدنى ${data.minimum}.` : `${data.readyOrders} ready orders; minimum is ${data.minimum}.`
              : ar ? "تم فحص جدولة الاستلام." : "Pickup scheduling checked.",
        );
      } else {
        toast.success(
          ar
            ? `تم ربط ${result.data?.linked ?? 0} وتحديث ${result.data?.refreshed ?? 0} شحنة.`
            : `Linked ${result.data?.linked ?? 0} and refreshed ${result.data?.refreshed ?? 0} shipments.`,
        );
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bosta operation failed");
    } finally {
      setAction(null);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-sky-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-base font-bold text-fg"><Truck size={18} className="text-sky-700" />Bosta Operations</div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-fg-dim">
            {ar ? "يتم تجهيز pickup يوميًا الساعة 12:00 صباحًا بتوقيت القاهرة عند وجود 3 طلبات بحالة قيد التجهيز، ويمكن تشغيله يدويًا هنا." : "A pickup runs daily at 12:00 AM Cairo time when at least 3 orders are processing. You can also run it manually here."}
          </p>
          {!configured ? <p className="mt-2 text-xs font-semibold text-amber-700">{ar ? "الربط غير مكتمل في متغيرات البيئة." : "The integration is not fully configured in environment variables."}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!configured || action !== null} onClick={() => void run("import")} className="btn btn-secondary px-4">
            {action === "import" ? <Loader2 size={16} className="animate-spin" /> : <DownloadCloud size={16} />}
            {ar ? "مزامنة شحنات Bosta" : "Import Bosta shipments"}
          </button>
          <button type="button" disabled={!configured || action !== null} onClick={() => void run("pickup")} className="btn btn-primary px-4">
            {action === "pickup" ? <Loader2 size={16} className="animate-spin" /> : <PackageCheck size={16} />}
            {ar ? "تشغيل pickup الآن" : "Run pickup now"}
          </button>
        </div>
      </div>

      {pickups.length ? (
        <div className="mt-5 grid gap-2 border-t border-border pt-4 md:grid-cols-2 xl:grid-cols-4">
          {pickups.slice(0, 4).map((pickup) => (
            <div key={pickup.automation_key} className="rounded-xl bg-slate-50 p-3 text-xs">
              <div className="flex items-center justify-between gap-2"><strong className="text-fg">{pickup.scheduled_date ?? pickup.created_at.slice(0, 10)}</strong><span className={pickup.status === "completed" ? "text-emerald-700" : pickup.status === "failed" ? "text-red-700" : "text-amber-700"}>{pickup.status}</span></div>
              <p className="mt-1 text-fg-dim">{pickup.parcel_count} {ar ? "شحنات" : "shipments"}{pickup.scheduled_time_slot ? ` · ${pickup.scheduled_time_slot}` : ""}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
