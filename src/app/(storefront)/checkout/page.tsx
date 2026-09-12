"use client";

import { normalizeContactDigits } from "@/lib/customers/validation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  CreditCard,
  Banknote,
  ShieldCheck,
  Loader2,
  Lock,
  ChevronDown,
  ChevronUp,
  Wind,
  Plus,
  Check,
  BadgePercent,
} from "lucide-react";
import { useLang } from "@/components/language/provider";
import { useCart, clearCart } from "@/lib/cart";
import { calcItemsSubtotal, calcOnlinePaymentDiscount } from "@/lib/pricing";
import { formatPrice } from "@/lib/utils";
import type { GovernorateOption } from "@/lib/data/locations";
import { useShippingQuote } from "@/components/storefront/use-shipping-quote";
import type { CustomerAddress } from "@/lib/customers/types";


interface BumpProduct {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  originalPrice: number;
  bumpPrice: number;
  desc_en?: string;
  desc_ar?: string;
  image: string | null;
  stock: number;
}

const PHONE_PATTERN = /^\d{6,20}$/;

function normalizePhone(value: string) { return normalizeContactDigits(value).slice(0, 20); }

export default function CheckoutPage() {
  const { t, lang } = useLang();
  const router = useRouter();
  const items = useCart();
  const ar = lang === "ar";

  const [governorates, setGovernorates] = useState<GovernorateOption[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [checkoutDataError, setCheckoutDataError] = useState(false);
  const [checkoutDataAttempt, setCheckoutDataAttempt] = useState(0);
  const [form, setForm] = useState({
    customer_name: "", customer_phone: "", alt_phone: "", governorate: "", city: "",
    address: "", notes: "", payment_method: "cod" as "cod" | "card", discount_code: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiscount, setShowDiscount] = useState(false);
  const [bumpAdded, setBumpAdded] = useState(false);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const [bumpProduct, setBumpProduct] = useState<BumpProduct | null>(null);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(600);

  const subtotal = calcItemsSubtotal(items);
  const bumpTotal = bumpAdded && bumpProduct ? bumpProduct.bumpPrice : 0;
  const checkoutItemsTotal = subtotal + bumpTotal;
  const onlineDiscount = calcOnlinePaymentDiscount(
    checkoutItemsTotal,
    form.payment_method,
  );
  const checkoutPayableItemsTotal = checkoutItemsTotal - onlineDiscount;
  const freeShipping = checkoutItemsTotal >= freeShippingThreshold;
  const shippingProductIds = [
    ...items.map((item) => item.id),
    ...(bumpAdded && bumpProduct ? [bumpProduct.id] : []),
  ];
  const shippingProductsKey = shippingProductIds.join(",");
  const { shipping, shippingLoading, shippingError, shippingOffer, retryShipping } =
    useShippingQuote(form.governorate, form.city, shippingProductsKey);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/checkout-data", { signal: AbortSignal.timeout(15000), cache: "no-store" })
        .then((r) => { if (!r.ok) throw new Error("Checkout unavailable"); return r.json(); }),
      fetch("/api/customer/addresses", { signal: AbortSignal.timeout(15000), cache: "no-store" })
        .then((r) => r.ok ? r.json() : { addresses: [] })
        .catch(() => ({ addresses: [] })),
    ])
      .then(([d, addressData]) => {
        if (!active) return;
        const threshold = Number(d.freeShippingThreshold);
        if (!d.governorates?.length || !Number.isFinite(threshold) || threshold <= 0) throw new Error("Invalid checkout options");
        setGovernorates(d.governorates ?? []);
        const addresses = Array.isArray(addressData.addresses) ? addressData.addresses as CustomerAddress[] : [];
        setSavedAddresses(addresses);
        const preferredAddress = addresses.find((address) => address.is_default) ?? addresses[0];
        if (preferredAddress) {
          setSelectedAddressId(preferredAddress.id);
          setForm((current) => current.customer_name || current.customer_phone || current.governorate || current.city || current.address
            ? current
            : {
                ...current,
                customer_name: preferredAddress.full_name,
                customer_phone: normalizePhone(preferredAddress.phone),
                governorate: preferredAddress.governorate,
                city: preferredAddress.city,
                address: preferredAddress.address,
              });
        }
        if (d.bumpProduct) setBumpProduct(d.bumpProduct);
        setFreeShippingThreshold(threshold);
        setCheckoutDataError(false);
      })
      .catch(() => { if (active) setCheckoutDataError(true); });
    return () => { active = false; };
  }, [checkoutDataAttempt]);

  const hasLocation = Boolean(form.governorate && form.city);
  const effectiveShipping = freeShipping ? 0 : shipping ?? 0;
  const total = checkoutPayableItemsTotal + (hasLocation ? effectiveShipping : 0);
  const quoteReady = hasLocation && shipping !== null && !shippingLoading && !shippingError;
  const shippingText = !hasLocation ? (ar ? "اختر المحافظة والمدينة" : "Choose governorate and city")
    : shippingLoading ? (ar ? "جاري حساب الشحن…" : "Calculating shipping…")
    : shippingError ? (ar ? "تعذر حساب الشحن" : "Shipping unavailable")
    : freeShipping ? (ar ? "مجاني" : "Free") : formatPrice(effectiveShipping, lang);
  const totalText = quoteReady ? formatPrice(total, lang) : (ar ? "بانتظار حساب الشحن" : "Awaiting shipping quote");
  const submitLabel = form.payment_method === "cod"
    ? (ar ? "تأكيد الطلب — الدفع عند الاستلام" : "Confirm — pay on delivery")
    : (ar ? "المتابعة للدفع بالبطاقة" : "Continue to card payment");
  const bumpDesc = bumpProduct
    ? (ar ? bumpProduct.desc_ar : bumpProduct.desc_en) || t.checkout.bumpDesc
    : t.checkout.bumpDesc;
  const duplicatePhones = Boolean(form.customer_phone && form.alt_phone && form.customer_phone === form.alt_phone);
  const selectedAddress = savedAddresses.find((address) => address.id === selectedAddressId);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) { setForm((f) => ({ ...f, [key]: value })); }

  function selectSavedAddress(id: string) {
    setSelectedAddressId(id);
    const address = savedAddresses.find((candidate) => candidate.id === id);
    if (!address) return;
    setForm((current) => ({
      ...current,
      customer_name: address.full_name,
      customer_phone: normalizePhone(address.phone),
      governorate: address.governorate,
      city: address.city,
      address: address.address,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (items.length === 0) { setError(ar ? "السلة فارغة." : "Your cart is empty."); return; }
    if (!quoteReady || submitting) return;
    if (!PHONE_PATTERN.test(form.customer_phone) || !PHONE_PATTERN.test(form.alt_phone)) {
      setError(ar ? "أدخل رقمَي هاتف صحيحين بالأرقام فقط." : "Enter two valid phone numbers using digits only.");
      return;
    }
    if (duplicatePhones) {
      setError(ar ? "رقم الهاتف البديل يجب أن يختلف عن رقم الهاتف الأساسي." : "The alternative phone number must be different from the main phone number.");
      return;
    }
    setSubmitting(true);
    try {
      const orderItems = items.map((i) => ({ product_id: i.id, name_en: i.name_en, name_ar: i.name_ar, price: i.price, quantity: i.quantity, image: i.image }));
      if (bumpAdded && bumpProduct) {
        orderItems.push({
          product_id: bumpProduct.id,
          name_en: `[Bump] ${bumpProduct.name_en}`,
          name_ar: `[عرض] ${bumpProduct.name_ar}`,
          price: bumpProduct.bumpPrice,
          quantity: 1,
          image: bumpProduct.image ?? "",
        });
      }
      const payload = { ...form, items: orderItems };
      const res = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok && data.redirect === "/account/complete-profile") { router.push("/account/complete-profile?next=%2Fcheckout"); return; }
      if (!res.ok) throw new Error(data.error || "Order failed");
      if (form.payment_method === "card" && data.redirect?.startsWith("http")) { clearCart(); window.location.href = data.redirect; return; }
      clearCart();
      router.push(data.redirect ?? `/checkout/success?order=${data.order_number}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : ar ? "حدث خطأ" : "An error occurred");
    } finally { setSubmitting(false); }
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 text-center">
        <h1 className="font-heading text-2xl font-bold text-fg">{t.cart.empty}</h1>
        <Link href="/category/carcare" className="btn btn-primary mt-6">{t.cart.continueShopping}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="flex items-center gap-3 font-heading text-3xl font-bold text-fg">
        <Lock size={24} className="text-brand" />
        {t.checkout.title}
      </h1>

      {/* Mobile mini summary (collapsible) */}
      <div className="mt-4 lg:hidden">
        <button
          type="button"
          aria-expanded={mobileSummaryOpen}
          aria-controls="mobile-order-items"
          onClick={() => setMobileSummaryOpen((v) => !v)}
          className="glass flex w-full items-center justify-between p-4"
        >
          <span className="text-sm text-fg-muted">
            {items.length} {t.checkout.items} &mdash; <span className="font-semibold text-brand">{formatPrice(checkoutPayableItemsTotal, lang)}</span>
          </span>
          {mobileSummaryOpen ? <ChevronUp size={16} className="text-fg-dim" /> : <ChevronDown size={16} className="text-fg-dim" />}
        </button>
        <dl className="mt-3 space-y-2 rounded-xl bg-surface p-4 text-sm" aria-live="polite">
          <Row label={t.cart.subtotal} value={formatPrice(subtotal, lang)} />
          {bumpTotal > 0 && <Row label={ar ? "العرض الإضافي" : "Add-on offer"} value={formatPrice(bumpTotal, lang)} />}
          {onlineDiscount > 0 && <Row label={ar ? "خصم الدفع الإلكتروني ٥٪" : "Online payment discount 5%"} value={`−${formatPrice(onlineDiscount, lang)}`} />}
          <Row label={t.cart.shipping} value={shippingText} />
          <Row label={ar ? "الإجمالي شامل الشحن" : "Total including shipping"} value={totalText} />
        </dl>
        {mobileSummaryOpen && (
          <div id="mobile-order-items" className="glass mt-1 max-h-48 space-y-2 overflow-y-auto p-4">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-xs">
                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-white">
                  <Image src={item.image} alt="" fill sizes="32px" className="object-contain p-0.5" />
                </div>
                <span className="min-w-0 flex-1 truncate text-fg-muted">{ar ? item.name_ar : item.name_en} x{item.quantity}</span>
                <span className="font-medium text-fg">{formatPrice(item.price * item.quantity, lang)}</span>
              </div>
            ))}
          </div>
        )}
        <Link href="/cart" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand underline">{ar ? "تعديل المنتجات أو الكمية" : "Edit items or quantities"}</Link>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-8 [&_input]:text-base [&_select]:text-base [&_textarea]:text-base lg:mt-8 lg:grid-cols-[1fr_380px]">
        {/* Form */}
        <div className="space-y-6">
          <div className="glass p-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-fg-muted">{t.checkout.contactInfo}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {checkoutDataError && <div role="alert" className="text-sm text-red-700 sm:col-span-2">
                <p>{ar ? "تعذر تحميل مناطق التوصيل. اضغط لإعادة المحاولة." : "Could not load delivery locations. Please try again."}</p>
                <button type="button" onClick={() => { setCheckoutDataError(false); setCheckoutDataAttempt((value) => value + 1); }} className="btn btn-secondary mt-2">{ar ? "إعادة المحاولة" : "Try again"}</button>
              </div>}
              {savedAddresses.length > 0 && (
                <Field label={ar ? "استخدم عنوانًا محفوظًا" : "Use a saved address"} className="sm:col-span-2">
                  <select value={selectedAddressId} onChange={(event) => selectSavedAddress(event.target.value)} className="input">
                    <option value="">{ar ? "تعديل بيانات التوصيل أو إدخال عنوان آخر" : "Edit delivery details or enter another address"}</option>
                    {savedAddresses.map((address) => (
                      <option key={address.id} value={address.id}>
                        {address.is_default ? (ar ? "الافتراضي — " : "Default — ") : ""}
                        {address.full_name} — {address.city} — {address.address}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {selectedAddress ? (
                <div className="rounded-xl border border-border bg-surface p-4 sm:col-span-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-fg">{selectedAddress.full_name}</p>
                      <p className="mt-1 text-sm text-fg-muted" dir="ltr">{selectedAddress.phone}</p>
                      <p className="mt-2 text-sm leading-6 text-fg-muted">
                        {selectedAddress.address}, {selectedAddress.city}, {selectedAddress.governorate}
                      </p>
                    </div>
                    {selectedAddress.is_default && (
                      <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                        {ar ? "العنوان الافتراضي" : "Default address"}
                      </span>
                    )}
                  </div>
                  <button type="button" onClick={() => setSelectedAddressId("")} className="mt-3 text-sm font-semibold text-brand underline">
                    {ar ? "تعديل بيانات هذا الطلب" : "Edit details for this order"}
                  </button>
                </div>
              ) : (
                <>
                  <Field label={t.checkout.fullName}>
                    <input required autoComplete="name" value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} className="input" placeholder={ar ? "محمد أحمد" : "Mohamed Ahmed"} />
                  </Field>
                  <Field label={t.checkout.phone}>
                    <input required type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={20} dir="ltr" value={form.customer_phone} onChange={(e) => set("customer_phone", normalizePhone(e.target.value))} className="input" placeholder="01XXXXXXXXX" aria-invalid={duplicatePhones} aria-describedby={duplicatePhones ? "phone-duplicate-error" : undefined} />
                  </Field>
                </>
              )}

              <Field label={ar ? "رقم هاتف بديل (مطلوب)" : "Alternative phone (required)"}>
                <input required type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={20} dir="ltr" value={form.alt_phone} onChange={(e) => set("alt_phone", normalizePhone(e.target.value))} className="input" placeholder="01XXXXXXXXX" aria-invalid={duplicatePhones} aria-describedby={duplicatePhones ? "phone-duplicate-error" : undefined} />
              </Field>
              {duplicatePhones && <p id="phone-duplicate-error" className="-mt-2 text-xs text-red-600 sm:col-span-2" role="alert">{ar ? "رقم الهاتف البديل يجب أن يختلف عن رقم الهاتف الأساسي." : "The alternative phone number must be different from the main phone number."}</p>}

              {!selectedAddress && (
                <>
                  <Field label={t.checkout.governorate}>
                    <select required value={form.governorate} onChange={(e) => { set("governorate", e.target.value); set("city", ""); }} className="input">
                      <option value="">{ar ? "اختر المحافظة" : "Select governorate"}</option>
                      {governorates.map((g) => <option key={g.ar} value={g.ar}>{ar ? g.ar : `${g.en} (${g.ar})`}</option>)}
                    </select>
                  </Field>
                  <Field label={t.checkout.city}>
                    <select required value={form.city} onChange={(e) => set("city", e.target.value)} className="input" disabled={!form.governorate}>
                      <option value="">{ar ? "اختر المدينة" : "Select city"}</option>
                      {governorates.find((g) => g.ar === form.governorate)?.cities.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                </>
              )}
              <div className="rounded-xl bg-surface p-4 text-sm sm:col-span-2" aria-live="polite">
                <p className="flex flex-wrap justify-between gap-2 font-semibold"><span>{t.cart.shipping}</span><span>{shippingText}</span></p>
                <p className="mt-1 text-fg-muted">
                  {shippingOffer && !freeShipping && quoteReady
                    ? (ar ? "شحن ٨٠ ج.م لأن كل منتجات سلتك ٤٥٠ مل. إضافة حجم آخر تعيد سعر الشحن المعتاد." : "EGP 80 shipping for your 450 ml items. Other sizes restore standard shipping.")
                    : (ar ? "هتعرف الإجمالي شامل الشحن قبل ما تأكد الطلب." : "See your total including shipping before confirming.")}
                </p>
                {shippingError && <button type="button" onClick={retryShipping} className="btn btn-secondary mt-3">{ar ? "إعادة حساب الشحن" : "Retry shipping"}</button>}
              </div>
              {!selectedAddress && (
                <Field label={t.checkout.address} className="sm:col-span-2">
                  <textarea
                    required
                    autoComplete="street-address"
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                    rows={2}
                    className="input"
                    placeholder={t.checkout.addressPlaceholder}
                  />
                </Field>
              )}
            </div>
          </div>

          {/* Payment */}
          <div className="glass p-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-fg-muted">{t.checkout.paymentMethod}</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <PaymentOption checked={form.payment_method === "cod"} onChange={() => set("payment_method", "cod")} Icon={Banknote} title={t.checkout.cod} hint={ar ? "ادفع نقدا عند الاستلام" : "Pay cash on arrival"} />
              <PaymentOption checked={form.payment_method === "card"} onChange={() => set("payment_method", "card")} Icon={CreditCard} title={t.checkout.card} hint={ar ? "خصم 5% — فيزا / ماستركارد عبر Kashier" : "5% off — Visa / Mastercard via Kashier"} badge={ar ? "خصم 5%" : "5% off"} />
            </div>
          </div>

          {bumpProduct && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-white p-4 lg:hidden">
              <input type="checkbox" checked={bumpAdded} onChange={(event) => setBumpAdded(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand" />
              <span className="text-sm">
                <span className="block font-semibold">{ar ? `أضف ${bumpProduct.name_ar} (اختياري)` : `Add ${bumpProduct.name_en} (optional)`}</span>
                <span className="mt-1 block font-bold text-brand">{formatPrice(bumpProduct.bumpPrice, lang)}</span>
                <span className="mt-1 block text-fg-muted">{ar ? "الإجمالي والشحن بيتحدثوا تلقائيًا بعد الإضافة." : "Total and shipping update after adding this item."}</span>
              </span>
            </label>
          )}

          {/* Collapsible discount code */}
          <div className="glass p-4">
            {showDiscount ? (
              <div className="flex gap-2">
                <input
                  value={form.discount_code}
                  onChange={(e) => set("discount_code", e.target.value)}
                  className="input flex-1"
                  placeholder={t.checkout.discountPlaceholder}
                />
              </div>
            ) : (
              <button type="button" onClick={() => setShowDiscount(true)} className="flex items-center gap-1.5 text-sm text-fg-dim transition hover:text-brand">
                <Plus size={14} />
                {t.checkout.discountToggle}
              </button>
            )}
          </div>
        </div>

        {/* Summary sidebar */}
        <aside className="glass-elevated hidden h-fit p-6 lg:block">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-fg-muted">{t.checkout.orderSummary}</h2>
          <div className="mt-5 max-h-60 space-y-3 overflow-y-auto pr-1">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white">
                  <Image src={item.image} alt="" fill sizes="44px" className="object-contain p-1" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-xs font-medium text-fg">{ar ? item.name_ar : item.name_en}</p>
                  <p className="text-xs text-fg-dim">x{item.quantity}</p>
                </div>
                <span className="text-xs font-medium text-fg">{formatPrice(item.price * item.quantity, lang)}</span>
              </div>
            ))}
          </div>

          <dl className="mt-5 space-y-2.5 border-t border-border pt-5 text-sm">
            <Row label={t.cart.subtotal} value={formatPrice(subtotal, lang)} />
            {onlineDiscount > 0 && (
              <div className="flex justify-between">
                <dt className="flex items-center gap-1.5 text-emerald-700"><BadgePercent size={14} />{ar ? "خصم الدفع الإلكتروني 5%" : "Online payment discount 5%"}</dt>
                <dd className="font-medium text-emerald-700">-{formatPrice(onlineDiscount, lang)}</dd>
              </div>
            )}
            {bumpTotal > 0 && <Row label={ar ? "عرض إضافي" : "Add-on offer"} value={formatPrice(bumpTotal, lang)} />}
            <Row
              label={t.cart.shipping}
              value={shippingText}
              dim={!hasLocation || shippingLoading}
            />
          </dl>
          <div className="mt-5 flex justify-between border-t border-border pt-5">
            <span className="font-semibold text-fg">{t.cart.total}</span>
            <span className="text-xl font-bold text-brand">{totalText}</span>
          </div>

          {/* Order bump — only show if bump product was resolved from DB */}
          {bumpProduct && (
            <div className={`mt-5 cursor-pointer p-4 ${bumpAdded ? "bump-card bump-card-active" : "bump-card"}`} onClick={() => setBumpAdded((v) => !v)}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${bumpAdded ? "border-gold bg-gold text-white" : "border-border"}`}>
                  {bumpAdded && <Check size={12} />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Wind size={14} className="text-gold" />
                    <span className="text-sm font-semibold text-fg">
                      {ar ? `أضف ${bumpProduct.name_ar}` : `Add ${bumpProduct.name_en}`}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-fg-dim">{bumpDesc}</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-sm font-bold text-gold">{formatPrice(bumpProduct.bumpPrice, lang)}</span>
                    <span className="text-xs text-fg-dim line-through">{formatPrice(bumpProduct.originalPrice, lang)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && <p className="mt-4 rounded-xl border border-brand/20 bg-brand/5 px-4 py-2.5 text-sm text-brand-soft">{error}</p>}

          <button type="submit" disabled={submitting || !quoteReady} className="btn btn-primary mt-6 w-full gap-2">
            {submitting ? <><Loader2 size={16} className="animate-spin" /> {ar ? "جارٍ المعالجة..." : "Processing..."}</> : <><ShieldCheck size={16} /> {submitLabel}</>}
          </button>

          {/* Security reassurance */}
          <div className="mt-4 space-y-1.5 text-center">
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-fg-dim">
              <Lock size={10} />
              {t.checkout.secureData}
            </p>
          </div>
        </aside>

        {/* Mobile sticky bottom bar */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white p-4 lg:hidden" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto flex max-w-6xl flex-col gap-2">
            {error && <p role="alert" className="max-h-20 overflow-auto text-sm text-red-700">{error}</p>}
            <div className="flex flex-col gap-2">
              <div className="flex-1">
                <p className="flex flex-wrap justify-between gap-2 text-sm"><span>{t.cart.shipping}</span><strong>{shippingText}</strong></p>
                <p className="mt-1 flex flex-wrap justify-between gap-2 text-sm"><span>{ar ? "الإجمالي شامل الشحن" : "Total including shipping"}</span><strong className="text-brand">{totalText}</strong></p>
              </div>
              <button type="submit" disabled={submitting || !quoteReady} className="btn btn-primary min-h-12 w-full gap-2">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                {submitting ? (ar ? "جاري تأكيد الطلب…" : "Confirming…") : submitLabel}
              </button>
            </div>

            {/* Security reassurance */}
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1 text-[10px] text-fg-dim">
                <Lock size={9} />
                {t.checkout.secureData}
              </p>
            </div>
          </div>
        </div>

        {/* Spacer for mobile sticky bar */}
        <div className="h-56 lg:hidden" />
      </form>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (<label className={`block ${className}`}><span className="mb-1.5 block text-xs font-medium text-fg-dim">{label}</span>{children}</label>);
}

function PaymentOption({ checked, onChange, Icon, title, hint, badge }: { checked: boolean; onChange: () => void; Icon: React.ComponentType<{ size?: number }>; title: string; hint: string; badge?: string }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${checked ? "border-brand bg-brand/5" : "border-border hover:border-border-hover"}`}>
      <input type="radio" name="payment_method" checked={checked} onChange={onChange} className="mt-1 accent-brand" />
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${checked ? "bg-brand/10 text-brand" : "bg-white/[0.03] text-fg-dim"}`}>
          <Icon size={18} />
        </div>
        <div>
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fg">
            {title}
            {badge ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">{badge}</span> : null}
          </span>
          <span className="block text-xs text-fg-dim">{hint}</span>
        </div>
      </div>
    </label>
  );
}

function Row({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (<div className="flex justify-between"><dt className="text-fg-dim">{label}</dt><dd className={dim ? "text-fg-dim" : "font-medium text-fg"}>{value}</dd></div>);
}
