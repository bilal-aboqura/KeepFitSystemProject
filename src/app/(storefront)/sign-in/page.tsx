import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { CustomerAuth } from "@/components/storefront/customer-auth";
import { safeReturnPath } from "@/lib/customers/return-path";
import { getLang } from "@/lib/i18n/server";
import { ui } from "@/lib/i18n/translations";
export default async function SignInPage({searchParams}:{searchParams:Promise<{next?:string;auth?:string}>}) {
  const sp=await searchParams;
  const lang=await getLang();
  const t=ui[lang].account;
  const ar=lang === "ar";

  return (
    <section className="bg-[#f7f7f5] px-5 py-8 sm:py-12 lg:py-16">
      <div className="mx-auto grid min-h-[calc(100dvh-9rem)] max-w-6xl overflow-hidden border border-black/15 bg-white lg:grid-cols-[1.08fr_0.92fr]">
        <div className="relative hidden min-h-[38rem] overflow-hidden bg-black lg:block">
          <Image
            src="/images/keepfit-sign-in-athlete.png"
            alt={ar ? "رياضي KeepFit يستعد للتمرين" : "KeepFit athlete preparing for training"}
            fill
            priority
            sizes="(max-width: 1024px) 0px, 55vw"
            className="object-cover object-top"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,5,0.08),rgba(5,5,5,0.82))]" />
          <div className="absolute inset-x-0 bottom-0 p-10 text-white">
            <p className="text-sm font-extrabold text-brand" dir="ltr">KEEPFIT / ACCOUNT</p>
            <h1 className="mt-4 max-w-md font-heading text-5xl font-black leading-tight text-balance">
              {ar ? "كل هدف يحتاج نقطة بداية." : "Every goal needs a starting point."}
            </h1>
            <p className="mt-5 max-w-md text-base leading-8 text-white/75">
              {ar ? "سجّل دخولك لمتابعة طلباتك، حفظ عناوينك، وتسوق أسرع في المرة القادمة." : "Sign in to follow your orders, save your addresses, and make your next purchase faster."}
            </p>
          </div>
        </div>

        <div className="flex min-h-full flex-col p-7 sm:p-10 lg:p-12">
          <Link href="/" className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-bold text-black/65 transition hover:text-black">
            <ArrowLeft size={17} className="rtl:rotate-180" />
            {ar ? "العودة للتسوق" : "Back to shopping"}
          </Link>

          <div className="my-auto max-w-sm py-12 sm:py-16">
            <div className="flex items-center gap-3">
              <Image src="/keepfit-logo.png" alt="KeepFit Supplement" width={816} height={768} className="h-14 w-16 object-contain" />
              <span className="text-sm font-black tracking-tight text-black" dir="ltr">KeepFit Supplement</span>
            </div>
            <p className="mt-10 text-sm font-extrabold text-brand" dir="ltr">WELCOME BACK</p>
            <h2 className="mt-3 font-heading text-4xl font-black leading-tight text-black sm:text-5xl">
              {ar ? "ادخل على حسابك" : "Access your account"}
            </h2>
            <p className="mt-4 text-base leading-8 text-black/65">
              {ar ? "سجّل دخولًا آمنًا لتتابع طلباتك وتحفظ تفاصيل التوصيل الخاصة بك." : "Sign in securely to follow your orders and keep your delivery details ready."}
            </p>

            {sp.auth ? <p role="alert" className="mt-7 border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-6 text-red-800">{t.authFailed}</p> : null}
            <div className="mt-8"><CustomerAuth next={safeReturnPath(sp.next)}/></div>

            <div className="mt-8 flex gap-3 border-t border-black/10 pt-6 text-sm leading-6 text-black/60">
              <ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand-dark" aria-hidden="true" />
              <p>{ar ? "نستخدم تسجيل دخول Google الآمن فقط، ولا نطلب منك كلمة مرور داخل KeepFit." : "We use secure Google sign-in only. KeepFit never asks you to create another password."}</p>
            </div>
          </div>

          <Link href="/" className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-bold text-black/65 transition hover:text-brand">
            {t.guest}
            <ArrowLeft size={16} className="rtl:rotate-180" />
          </Link>
        </div>
      </div>
    </section>
  );
}
