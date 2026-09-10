"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CheckCircle, ShoppingBag } from "lucide-react";
import { CART_ITEM_ADDED_EVENT } from "@/lib/cart";
import { useLang } from "@/components/language/provider";

export function CartAddPrompt() {
  const { lang } = useLang();
  const router = useRouter();
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const previousOverflow = useRef("");
  const ar = lang === "ar";

  useEffect(() => {
    const element = dialog.current;
    const show = () => {
      if (!element || element.open) return;
      previousFocus.current = document.activeElement as HTMLElement | null;
      previousOverflow.current = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      element.showModal();
    };
    const restore = () => {
      document.body.style.overflow = previousOverflow.current;
      previousFocus.current?.focus();
    };
    element?.addEventListener("close", restore);
    window.addEventListener(CART_ITEM_ADDED_EVENT, show);
    return () => {
      window.removeEventListener(CART_ITEM_ADDED_EVENT, show);
      element?.removeEventListener("close", restore);
      if (element?.open) { element.close(); restore(); }
    };
  }, []);

  useEffect(() => { dialog.current?.close(); }, [pathname]);

  return (
      <dialog
        ref={dialog}
        aria-labelledby="cart-add-title"
        aria-describedby="cart-add-description"
        className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl bg-white p-5 text-center text-fg backdrop:bg-black/45"
        dir={ar ? "rtl" : "ltr"}
      >
        <CheckCircle size={30} className="mx-auto text-emerald" aria-hidden="true" />
        <h2 id="cart-add-title" className="mt-3 text-xl font-bold text-fg">
          {ar ? "تمت الإضافة للسلة" : "Added to your cart"}
        </h2>
        <p id="cart-add-description" className="mt-1.5 text-sm text-fg-muted">
          {ar ? "نكمل الطلب ولا تحب تضيف حاجة تانية؟" : "Ready to order, or want to add something else?"}
        </p>
        <div className="mt-5 grid gap-3">
          <button type="button" onClick={() => { dialog.current?.close(); router.push("/checkout"); }} className="btn btn-primary min-h-12 justify-center">
            {ar ? "إتمام الطلب" : "Checkout"}
          </button>
          <button type="button" onClick={() => dialog.current?.close()} className="btn btn-secondary min-h-12 justify-center">
            <ShoppingBag size={16} />
            {ar ? "أكمل التسوق" : "Keep shopping"}
          </button>
        </div>
      </dialog>
  );
}
