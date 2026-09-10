"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import type { MylerzShipment } from "@/lib/mylerz";
import { mylerzStatusLabel } from "@/lib/mylerz-status";
import { useToast } from "@/components/admin/toast";

export function MylerzShipmentPanel({
  orderId,
  initialShipment,
  configured,
  blocked = false,
  lang,
}: {
  orderId: string;
  initialShipment: MylerzShipment | null;
  configured: boolean;
  blocked?: boolean;
  lang: "ar" | "en";
}) {
  const ar = lang === "ar";
  const router = useRouter();
  const toast = useToast();
  const [shipment, setShipment] = useState(initialShipment);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/orders/mylerz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: orderId,
          action: shipment ? "sync" : "create",
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Mylerz request failed");
      setShipment(result.data.mylerz);
      toast.success(ar ? "تم تحديث شحنة Mylerz" : "Mylerz shipment updated");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Mylerz request failed",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-white p-4"
      aria-label="Mylerz"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Mylerz</h3>
        <span className="text-sm">
          {shipment
            ? mylerzStatusLabel(shipment.status, lang)
            : ar
              ? "غير مرسل"
              : "Not sent"}
        </span>
      </div>
      {!configured && (
        <p className="text-sm text-amber-800">
          {ar
            ? "بيانات حساب Mylerz غير مكتملة."
            : "Mylerz account configuration is incomplete."}
        </p>
      )}
      {blocked && !shipment && (
        <p className="text-sm text-fg-dim">
          {ar
            ? "الطلب مربوط ببوسطة بالفعل."
            : "This order already has a Bosta shipment."}
        </p>
      )}
      {shipment && (
        <>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-fg-dim">
                {ar ? "رقم التتبع" : "Tracking number"}
              </dt>
              <dd dir="ltr" className="font-mono">
                {shipment.trackingNumber}
              </dd>
            </div>
            <div>
              <dt className="text-fg-dim">
                {ar ? "الحالة لدى Mylerz" : "Mylerz status"}
              </dt>
              <dd>{shipment.status}</dd>
            </div>
            <div>
              <dt className="text-fg-dim">
                {ar ? "آخر تحديث" : "Last update"}
              </dt>
              <dd>
                {new Date(shipment.statusUpdatedAt).toLocaleString(
                  ar ? "ar-EG" : "en-GB",
                )}
              </dd>
            </div>
          </dl>
          {shipment.timeline?.length ? (
            <ol className="max-h-44 space-y-2 overflow-auto text-xs">
              {shipment.timeline.map((event, index) => (
                <li key={index}>
                  {event.status}
                  {event.changedAt && (
                    <span className="ms-2 text-fg-dim">
                      {new Date(event.changedAt).toLocaleString(
                        ar ? "ar-EG" : "en-GB",
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          ) : null}
        </>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={run}
          disabled={busy || !configured || (blocked && !shipment)}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
        >
          {busy
            ? ar
              ? "جاري الاتصال…"
              : "Connecting…"
            : shipment
              ? ar
                ? "تحديث الحالة"
                : "Sync status"
              : ar
                ? "إنشاء شحنة Mylerz"
                : "Create Mylerz shipment"}
        </button>
        {shipment && (
          <a
            className="rounded-lg border border-border px-4 py-2 text-sm underline"
            href={`/api/admin/orders/mylerz/awb?id=${orderId}`}
          >
            {ar ? "تحميل البوليصة PDF" : "Download AWB PDF"}
          </a>
        )}
      </div>
    </section>
  );
}

export function MylerzConnection({
  configured,
  lang,
}: {
  configured: boolean;
  lang: "ar" | "en";
}) {
  const router = useRouter();
  const [action, setAction] = useState<"verify" | "sync" | null>(null);
  const [message, setMessage] = useState("");
  const ar = lang === "ar";
  async function verify() {
    setAction("verify");
    try {
      const response = await fetch("/api/admin/orders/mylerz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Connection failed");
      setMessage(
        ar
          ? `تم الاتصال بنجاح · ${result.data.warehouses} مخزن`
          : `Connected · ${result.data.warehouses} warehouses`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Connection failed");
    } finally {
      setAction(null);
    }
  }
  async function sync() {
    setAction("sync");
    try {
      const response = await fetch("/api/admin/orders/mylerz/sync", { method: "POST" });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Mylerz sync failed");
      setMessage(
        ar
          ? `تمت مزامنة ${result.data.updated} شحنة${result.data.failed ? `، وتعذر تحديث ${result.data.failed}` : ""}.`
          : `${result.data.updated} shipments synchronized${result.data.failed ? `; ${result.data.failed} failed` : ""}.`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mylerz sync failed");
    } finally {
      setAction(null);
    }
  }
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white p-4 text-sm">
      <strong>Mylerz</strong>
      <span>
        {configured
          ? ar
            ? "بيانات الربط جاهزة"
            : "Configuration ready"
          : ar
            ? "بانتظار بيانات الحساب"
            : "Account configuration required"}
      </span>
      <div className="ms-auto flex flex-wrap gap-2">
      <button
        type="button"
        disabled={!configured || action !== null}
        onClick={verify}
        className="btn btn-secondary px-3"
      >
        {action === "verify" ? <Loader2 size={16} className="animate-spin" /> : null}
        {ar ? "اختبار الاتصال" : "Test connection"}
      </button>
      <button
        type="button"
        disabled={!configured || action !== null}
        onClick={sync}
        className="btn btn-primary px-3"
      >
        {action === "sync" ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        {ar ? "مزامنة شحنات Mylerz" : "Sync Mylerz shipments"}
      </button>
      </div>
      <p role="status" className="w-full empty:hidden">
        {message}
      </p>
    </div>
  );
}
