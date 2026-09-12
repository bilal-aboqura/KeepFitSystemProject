import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

type CatalogFamily = "supplements" | "performance";

const familyContent = {
  supplements: {
    eyebrow: "KeepFit / Nutrition",
    title: "المكملات الغذائية",
    description: "اختار احتياجك من الأقسام الأساسية، وخلي التسوّق أبسط من أول بحث لحد المنتج المناسب.",
    accentClassName: "text-brand",
    buttonClassName: "bg-brand text-black",
    pageClassName: "bg-[#f7f7f5] text-[#111111]",
    boundaryClassName: "border-black/10",
    surfaceClassName: "border-black bg-brand text-black",
    heroTitleClassName: "text-white",
    heroCopyClassName: "text-white/80",
    titleClassName: "text-black",
    copyClassName: "text-black/70",
    cardClassName: "border-black/15 bg-white hover:border-black hover:bg-[#fffdf1]",
    image: "/images/keepfit-nutrition-still-life.png",
    imageAlt: "عبوة بروتين وشيكر على منصة KeepFit الصفراء",
    categories: [
      { slug: "protein", title: "مكملات بروتين" },
      { slug: "creatine", title: "مكملات كرياتين" },
      { slug: "amino-acids", title: "أحماض أمينية" },
      { slug: "vitamins", title: "فيتامينات ومعادن" },
      { slug: "pre-workout", title: "مكملات طاقة" },
      { slug: "mass-gainer", title: "الماس جينر وزيادة الوزن" },
      { slug: "fat-burner", title: "حوارق دهون" },
      { slug: "carbohydrates", title: "مكملات كربوهيدرات" },
    ],
  },
  performance: {
    eyebrow: "KeepFit / Performance",
    title: "الأداء الرياضي",
    description: "تصفّح اختيارات قانونية ومصرّح بها لروتين التمرين، من الطاقة قبل التمرين حتى الإكسسوارات.",
    accentClassName: "text-brand",
    buttonClassName: "bg-brand text-black",
    pageClassName: "bg-[#090909] text-white",
    boundaryClassName: "border-white/10",
    surfaceClassName: "border-brand bg-[radial-gradient(circle_at_12%_0%,rgba(255,204,0,0.2),transparent_34%),#111111] text-white",
    heroTitleClassName: "text-white",
    heroCopyClassName: "text-white/70",
    titleClassName: "text-white",
    copyClassName: "text-white/70",
    cardClassName: "border-white/10 bg-white/[0.025] hover:border-brand hover:bg-white/[0.06]",
    image: "/images/keepfit-performance-training.png",
    imageAlt: "تجهيز رياضي لرفع الأوزان داخل الجيم",
    categories: [
      { slug: "pre-workout", title: "طاقة قبل التمرين" },
      { slug: "creatine", title: "كرياتين" },
      { slug: "amino-acids", title: "أحماض أمينية" },
      { slug: "carbohydrates", title: "كربوهيدرات وزيادة وزن" },
      { slug: "accessories", title: "إكسسوارات التمرين" },
      { slug: "other-products", title: "منتجات أخرى" },
    ],
  },
};

export function CatalogFamilyPage({ family }: { family: CatalogFamily }) {
  const content = familyContent[family];

  return (
    <main className={`min-h-[calc(100dvh-72px)] ${content.pageClassName}`}>
      <section className={`border-b px-5 py-16 sm:px-8 sm:py-20 lg:py-28 ${content.boundaryClassName}`}>
        <div className={`relative mx-auto max-w-7xl overflow-hidden border p-7 sm:p-12 lg:p-16 ${content.surfaceClassName}`}>
          <Image
            src={content.image}
            alt={content.imageAlt}
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,5,0.82)_0%,rgba(5,5,5,0.42)_52%,rgba(5,5,5,0.1)_100%)]" />
          <div className="relative z-10">
          <Link href="/" className={`inline-flex min-h-11 items-center gap-2 text-sm font-bold ${content.accentClassName}`}>
            <ArrowLeft size={17} />
            العودة لاختيار المتجر
          </Link>
          <p className={`mt-14 text-sm font-bold ${content.accentClassName}`} dir="ltr">{content.eyebrow}</p>
          <h1 className={`mt-4 max-w-3xl font-heading text-balance text-[clamp(3rem,7vw,6rem)] font-extrabold leading-[1.14] ${content.heroTitleClassName}`}>
            {content.title}
          </h1>
          <p className={`mt-6 max-w-2xl text-pretty text-base leading-8 sm:text-lg sm:leading-9 ${content.heroCopyClassName}`}>
            {content.description}
          </p>
          </div>
        </div>
      </section>

      <section id="categories" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="flex items-end justify-between gap-5">
          <div>
            <h2 className={`font-heading text-3xl font-extrabold ${content.titleClassName}`}>الأقسام</h2>
            <p className={`mt-3 text-base ${content.copyClassName}`}>ابدأ بالقسم الأقرب لهدفك.</p>
          </div>
          <span className={`hidden text-sm font-bold sm:block ${content.accentClassName}`}>{content.categories.length} أقسام</span>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {content.categories.map(({ slug, title }, index) => (
            <Link
              key={slug}
              href={`/category/${slug}`}
              className={`group overflow-hidden border p-0 transition duration-200 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand ${content.cardClassName}`}
            >
              <div className="relative h-24 overflow-hidden">
                <Image
                  src={content.image}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                  style={{ objectPosition: `${15 + (index % 4) * 23}% 50%` }}
                />
                <div className="absolute inset-0 bg-black/35" />
              </div>
              <div className="flex min-h-20 items-end justify-between gap-3 p-5">
                <h3 className={`font-heading text-lg font-bold leading-7 ${content.titleClassName}`}>{title}</h3>
                <ArrowLeft size={18} className={`shrink-0 transition group-hover:-translate-x-1 ${content.accentClassName}`} />
              </div>
            </Link>
          ))}
        </div>

        <Link href="#categories" className={`mt-10 inline-flex min-h-12 items-center gap-3 px-5 text-sm font-extrabold ${content.buttonClassName}`}>
          تصفّح الأقسام
          <ArrowLeft size={18} />
        </Link>
      </section>
    </main>
  );
}
