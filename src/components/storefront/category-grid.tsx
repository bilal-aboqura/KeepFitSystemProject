import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

export function CategoryGrid() {
  const stores = [
    {
      href: "/supplements",
      image: "/images/keepfit-nutrition-still-life.png",
      imageAlt: "عبوة بروتين وشيكر على منصة KeepFit الصفراء",
      title: "المكملات الغذائية",
      description: "بروتين، كرياتين، فيتامينات، طاقة، زيادة وزن وأكثر.",
      action: "تسوّق المكملات",
      className: "border-brand hover:border-white",
      actionClassName: "bg-brand text-black",
    },
    {
      href: "/performance",
      image: "/images/keepfit-performance-training.png",
      imageAlt: "تجهيز رياضي لرفع الأوزان داخل الجيم",
      title: "الأداء الرياضي",
      description: "اختيارات قانونية لروتين التمرين: طاقة، تحمّل، استشفاء وإكسسوارات.",
      action: "اكتشف الأداء الرياضي",
      className: "border-black hover:border-brand",
      actionClassName: "bg-brand text-black",
    },
  ];

  return (
    <section id="categories" className="border-b border-black/10 bg-[#f7f7f5] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl font-extrabold text-black sm:text-4xl">
            اختار المتجر المناسب لهدفك
          </h2>
          <p className="mt-3 text-base leading-7 text-black/65">
            كل قسم له تجربة مستقلة تساعدك تتصفح المنتجات المناسبة بدون زحمة.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {stores.map((store) => (
            <Link
              key={store.href}
              href={store.href}
              className={`group relative min-h-[25rem] overflow-hidden border p-7 transition duration-300 hover:-translate-y-1 sm:p-10 ${store.className}`}
            >
              <Image
                src={store.image}
                alt={store.imageAlt}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,5,0.94)_0%,rgba(5,5,5,0.63)_52%,rgba(5,5,5,0.08)_100%)]" />
              <div className="relative z-10 flex min-h-[calc(25rem-3.5rem)] max-w-md flex-col justify-end">
                <h3 className="font-heading text-3xl font-extrabold text-white sm:text-4xl">
                  {store.title}
                </h3>
                <p className="mt-4 text-base leading-8 text-white/80">
                  {store.description}
                </p>
                <span className={`mt-9 inline-flex min-h-12 w-fit items-center gap-3 px-5 text-sm font-extrabold ${store.actionClassName}`}>
                  {store.action}
                  <ArrowLeft size={18} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
