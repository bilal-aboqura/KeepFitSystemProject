import { getLang, getT } from "@/lib/i18n/server";
import { MessageCircle, ExternalLink as FacebookIcon, Clock, ArrowUpRight } from "lucide-react";

export default async function ContactPage() {
  const [lang, t] = await Promise.all([getLang(), getT()]);
  const ar = lang === "ar";

  return (
    <div className="mx-auto max-w-4xl px-5 py-14">
      <h1 className="font-heading text-4xl font-bold text-fg">{t.nav.contact}</h1>
      <p className="mt-2 text-sm text-fg-dim">{ar ? "نحن هنا لمساعدتك — تواصل معنا عبر القنوات التالية." : "We're here to help. Reach us through the channels below."}</p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <ContactCard
          href="https://wa.me/201150301033"
          Icon={MessageCircle}
          title="WhatsApp"
          detail="+20 115 030 1033"
          cta={ar ? "محادثة الآن" : "Chat now"}
        />
        <ContactCard
          href="https://www.facebook.com/officialxeemo"
          Icon={FacebookIcon}
          title="Facebook"
          detail="@officialxeemo"
          cta={ar ? "زيارة الصفحة" : "Visit page"}
        />
      </div>

      <div className="glass mt-4 flex items-start gap-4 p-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.03] text-fg-dim">
          <Clock size={20} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-fg">{ar ? "أوقات العمل" : "Business hours"}</h2>
          <p className="mt-1 text-sm text-fg-dim">{ar ? "السبت – الخميس، ٩ صباحا حتى ٦ مساء (بتوقيت القاهرة)." : "Saturday to Thursday, 9 AM to 6 PM (Cairo time)."}</p>
        </div>
      </div>
    </div>
  );
}

function ContactCard({ href, Icon, title, detail, cta }: { href: string; Icon: React.ComponentType<{ size?: number }>; title: string; detail: string; cta: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="glass group flex items-start gap-4 p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-lg hover:shadow-brand/5">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-white">
        <Icon size={22} />
      </div>
      <div className="flex-1">
        <span className="block text-base font-semibold text-fg">{title}</span>
        <span className="mt-0.5 block text-sm text-fg-dim" dir="ltr">{detail}</span>
        <span className="mt-3 flex items-center gap-1 text-sm font-medium text-brand opacity-0 transition group-hover:opacity-100">
          {cta} <ArrowUpRight size={14} />
        </span>
      </div>
    </a>
  );
}
