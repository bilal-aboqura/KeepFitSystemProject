"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Save, Search, X } from "lucide-react";
import { useLang } from "@/components/language/provider";
import { useToast } from "@/components/admin/toast";
import { ImageUpload } from "@/components/admin/image-upload";

interface SettingValue {
  value_en: string;
  value_ar: string;
}

type Fields = Record<string, SettingValue>;

interface HeroSlideDraft {
  image: string;
  title_en: string;
  title_ar: string;
  subtitle_en: string;
  subtitle_ar: string;
  cta_en: string;
  cta_ar: string;
  href: string;
}

interface ProductOption {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  price: number;
  stock: number;
  is_active: boolean;
}

interface CategoryOption {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
}

const DEFAULT_HERO_IMAGES = [
  "/images/gold_1l.webp",
  "/images/foam4k.webp",
  "/images/tireprime.webp",
  "/images/enginecleaner-1l.webp",
  "/images/universal-1l.webp",
  "/images/rims-4k.webp",
  "/images/candy-4k.webp",
  "/images/black-ice-4k.webp",
];

const DEFAULT_HERO_SLIDES: HeroSlideDraft[] = [
  {
    image: "/images/hs.webp",
    title_en: "Your car will look showroom-fresh",
    title_ar: "عربيتك هتبان كأنها لسه نازلة من المعرض",
    subtitle_en: "The detailing products that car wash pros use - now in your hands.",
    subtitle_ar: "منتجات التلميع والعناية اللي بيستخدمها أصحاب المغاسل - دلوقتي في إيدك.",
    cta_en: "See the Best Sellers",
    cta_ar: "شوف الأكثر مبيعاً",
    href: "#bestsellers",
  },
];

const DEFAULTS: Fields = {
  store_name: { value_en: "Xeemo", value_ar: "اكسيمو" },
  store_tagline: { value_en: "Car Care Chemicals", value_ar: "كيماويات العناية بالسيارات" },
  store_phone: { value_en: "+201150301033", value_ar: "+201150301033" },
  store_email: { value_en: "", value_ar: "" },
  store_facebook: { value_en: "https://www.facebook.com/officialxeemo", value_ar: "https://www.facebook.com/officialxeemo" },
  hero_slides: { value_en: JSON.stringify(DEFAULT_HERO_SLIDES), value_ar: "" },
  hero_title: { value_en: "Your car will look showroom-fresh", value_ar: "عربيتك هتبان كأنها لسه نازلة من المعرض" },
  hero_subtitle: { value_en: "The detailing products that car wash pros use — now in your hands.", value_ar: "منتجات التلميع والعناية اللي بيستخدمها أصحاب المغاسل — دلوقتي في إيدك." },
  hero_cta: { value_en: "See the Best Sellers", value_ar: "شوف الأكثر مبيعاً" },
  hero_background_image: { value_en: "/images/hs.webp", value_ar: "" },
  hero_images: { value_en: JSON.stringify(DEFAULT_HERO_IMAGES), value_ar: "" },
  hero_pill_cod: { value_en: "Cash on Delivery", value_ar: "الدفع عند الاستلام" },
  hero_pill_returns: { value_en: "7-day returns", value_ar: "استرجاع 7 أيام" },
  hero_pill_shipping: { value_en: "Free shipping 600+ EGP", value_ar: "شحن مجاني فوق 600 ج.م" },
  hero_marquee_cod: { value_en: "Pay when it arrives - not before", value_ar: "ادفع لما المنتج يوصلك - مش قبلها" },
  hero_marquee_returns: { value_en: "7-day hassle-free returns", value_ar: "استرجاع خلال 7 أيام" },
  hero_marquee_made: { value_en: "100% Made in Egypt", value_ar: "صناعة مصرية 100%" },
  hero_marquee_shipping: { value_en: "Free shipping over 600 EGP", value_ar: "شحن مجاني فوق 600 ج.م" },
  hero_marquee_payments: { value_en: "Secure card payments", value_ar: "دفع آمن بالبطاقة" },
  free_shipping_threshold: { value_en: "600", value_ar: "600" },
  order_bump_product_slugs: { value_en: "[]", value_ar: "" },
  order_bump_product_slug: { value_en: "", value_ar: "" },
  order_bump_price: { value_en: "280", value_ar: "280" },
  order_bump_desc: { value_en: "Signature scent for your car - checkout-only price", value_ar: "ريحة مميزة لعربيتك - سعر خاص مع طلبك" },
  stat_customers: { value_en: "+500", value_ar: "+500" },
  stat_carwashes: { value_en: "+50", value_ar: "+50" },
  stat_rating: { value_en: "4.8/5", value_ar: "4.8/5" },
};

interface SectionDef {
  title: { en: string; ar: string };
  keys: {
    key: string;
    label: { en: string; ar: string };
    bilingual?: boolean;
    type?: "number" | "image" | "hero-images" | "hero-slides";
  }[];
}

const SECTIONS: SectionDef[] = [
  {
    title: { en: "Branding", ar: "العلامة التجارية" },
    keys: [
      { key: "store_name", label: { en: "Store Name", ar: "اسم المتجر" }, bilingual: true },
      { key: "store_tagline", label: { en: "Tagline", ar: "الشعار" }, bilingual: true },
    ],
  },
  {
    title: { en: "Contact Info", ar: "معلومات التواصل" },
    keys: [
      { key: "store_phone", label: { en: "WhatsApp / Phone", ar: "واتساب / هاتف" } },
      { key: "store_email", label: { en: "Contact Email", ar: "البريد الإلكتروني" } },
      { key: "store_facebook", label: { en: "Facebook URL", ar: "رابط فيسبوك" } },
    ],
  },
  {
    title: { en: "Homepage Hero", ar: "القسم الرئيسي" },
    keys: [
      { key: "hero_slides", label: { en: "Hero Carousel Slides", ar: "سلايدر الهيرو" }, type: "hero-slides" },
      { key: "hero_pill_cod", label: { en: "COD Badge Text", ar: "نص شارة الدفع عند الاستلام" }, bilingual: true },
      { key: "hero_pill_returns", label: { en: "Returns Badge Text", ar: "نص شارة الاسترجاع" }, bilingual: true },
      { key: "hero_pill_shipping", label: { en: "Shipping Badge Text", ar: "نص شارة الشحن" }, bilingual: true },
      { key: "hero_marquee_cod", label: { en: "Marquee COD Text", ar: "نص شريط الدفع عند الاستلام" }, bilingual: true },
      { key: "hero_marquee_returns", label: { en: "Marquee Returns Text", ar: "نص شريط الاسترجاع" }, bilingual: true },
      { key: "hero_marquee_made", label: { en: "Marquee Made in Egypt Text", ar: "نص شريط صناعة مصرية" }, bilingual: true },
      { key: "hero_marquee_shipping", label: { en: "Marquee Shipping Text", ar: "نص شريط الشحن" }, bilingual: true },
      { key: "hero_marquee_payments", label: { en: "Marquee Payments Text", ar: "نص شريط الدفع الإلكتروني" }, bilingual: true },
    ],
  },
  {
    title: { en: "Offers & Social Proof", ar: "العروض والإثبات الاجتماعي" },
    keys: [
      { key: "free_shipping_threshold", label: { en: "Free Shipping Threshold (EGP)", ar: "حد الشحن المجاني (ج.م)" }, type: "number" },
      { key: "order_bump_product_slugs", label: { en: "Suggested Products", ar: "المنتجات المقترحة" } },
      { key: "order_bump_price", label: { en: "Suggested Product Checkout Price (EGP)", ar: "سعر المنتج المقترح في الدفع (ج.م)" }, type: "number" },
      { key: "order_bump_desc", label: { en: "Suggested Product Description", ar: "وصف المنتج المقترح" }, bilingual: true },
      { key: "stat_customers", label: { en: "Customer Count", ar: "عدد العملاء" }, type: "number" },
      { key: "stat_carwashes", label: { en: "Car Wash Count", ar: "عدد الغسلات" }, type: "number" },
      { key: "stat_rating", label: { en: "Rating", ar: "التقييم" }, type: "number" },
    ],
  },
];

const inputCls =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-fg outline-none focus:border-brand";

export default function CustomizePage() {
  const { lang } = useLang();
  const ar = lang === "ar";
  const toast = useToast();

  const [fields, setFields] = useState<Fields>(DEFAULTS);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/settings").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/admin/products").then((r) => (r.ok ? r.json() : { products: [] })),
      fetch("/api/admin/categories").then((r) => (r.ok ? r.json() : { categories: [] })),
    ])
      .then(([settings, productsData, categoriesData]: [
        { key: string; value_en: string; value_ar: string }[],
        { products?: ProductOption[] },
        { categories?: CategoryOption[] },
      ]) => {
        setFields((prev) => {
          const next = { ...prev };
          const hasHeroSlidesSetting = settings.some((row) => row.key === "hero_slides" && row.value_en.trim());
          for (const row of settings) {
            if (row.key in next) {
              next[row.key] = { value_en: row.value_en, value_ar: row.value_ar };
            }
          }
          const oldSlug = settings.find((row) => row.key === "order_bump_product_slug")?.value_en;
          const hasNewSelection = next.order_bump_product_slugs.value_en !== "[]";
          if (!hasNewSelection && oldSlug) {
            next.order_bump_product_slugs = {
              value_en: JSON.stringify([oldSlug]),
              value_ar: "",
            };
          }
          if (!hasHeroSlidesSetting) {
            next.hero_slides = {
              value_en: JSON.stringify([
                {
                  ...DEFAULT_HERO_SLIDES[0],
                  image: next.hero_background_image.value_en || DEFAULT_HERO_SLIDES[0].image,
                  title_en: next.hero_title.value_en || DEFAULT_HERO_SLIDES[0].title_en,
                  title_ar: next.hero_title.value_ar || DEFAULT_HERO_SLIDES[0].title_ar,
                  subtitle_en: next.hero_subtitle.value_en || DEFAULT_HERO_SLIDES[0].subtitle_en,
                  subtitle_ar: next.hero_subtitle.value_ar || DEFAULT_HERO_SLIDES[0].subtitle_ar,
                  cta_en: next.hero_cta.value_en || DEFAULT_HERO_SLIDES[0].cta_en,
                  cta_ar: next.hero_cta.value_ar || DEFAULT_HERO_SLIDES[0].cta_ar,
                },
              ]),
              value_ar: "",
            };
          }
          return next;
        });
        setProducts(productsData.products ?? []);
        setCategories(categoriesData.categories ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function update(key: string, field: "value_en" | "value_ar", value: string) {
    setFields((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }

  async function saveSection(sectionIndex: number) {
    const section = SECTIONS[sectionIndex];
    setSavingSection(sectionIndex);
    try {
      for (const { key } of section.keys) {
        const { value_en, value_ar } = fields[key];
        const res = await fetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value_en, value_ar }),
        });
        if (!res.ok) throw new Error(await res.text());
      }
      toast.success(ar ? "تم الحفظ" : "Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ar ? "فشل الحفظ" : "Save failed");
    } finally {
      setSavingSection(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-fg-dim" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-fg">
        {ar ? "التخصيص" : "Customize"}
      </h1>
      <p className="mt-1 text-sm text-fg-dim">
        {ar
          ? "خصّص مظهر المتجر والعلامة التجارية والمحتوى."
          : "Customize your store appearance, branding, and content."}
      </p>

      <div className="mt-6 space-y-6">
        {SECTIONS.map((section, si) => (
          <div key={si} className="glass p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-fg-muted">
                {ar ? section.title.ar : section.title.en}
              </h2>
              <button
                onClick={() => saveSection(si)}
                disabled={savingSection === si}
                className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {savingSection === si ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Save size={12} />
                )}
                {savingSection === si
                  ? ar ? "جارٍ الحفظ…" : "Saving…"
                  : ar ? "حفظ" : "Save"}
              </button>
            </div>

            <div className="space-y-4">
              {section.keys.map(({ key, label, bilingual, type }) => (
                <div key={key}>
                  <span className="mb-1.5 block text-xs font-medium text-fg-dim">
                    {ar ? label.ar : label.en}
                  </span>
                  {type === "image" ? (
                    <ImageUpload
                      value={fields[key].value_en}
                      onChange={(value) => update(key, "value_en", value)}
                      label={ar ? label.ar : label.en}
                      lang={lang}
                      aspectRatio={16 / 9}
                    />
                  ) : type === "hero-images" ? (
                    <HeroImagesEditor
                      value={fields[key].value_en}
                      lang={lang}
                      onChange={(value) => update(key, "value_en", value)}
                    />
                  ) : type === "hero-slides" ? (
                    <HeroSlidesEditor
                      value={fields[key].value_en}
                      lang={lang}
                      products={products}
                      categories={categories}
                      onChange={(value) => update(key, "value_en", value)}
                    />
                  ) : key === "order_bump_product_slugs" ? (
                    <ProductMultiPicker
                      value={fields[key].value_en}
                      products={products}
                      lang={lang}
                      onChange={(value) => update(key, "value_en", value)}
                    />
                  ) : bilingual ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-fg-dim/60">English</span>
                        <input
                          value={fields[key].value_en}
                          onChange={(e) => update(key, "value_en", e.target.value)}
                          className={inputCls}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-fg-dim/60">العربية</span>
                        <input
                          value={fields[key].value_ar}
                          onChange={(e) => update(key, "value_ar", e.target.value)}
                          dir="rtl"
                          className={inputCls}
                        />
                      </label>
                    </div>
                  ) : (
                    <input
                      value={fields[key].value_en}
                      onChange={(e) => update(key, "value_en", e.target.value)}
                      type={type === "number" ? "number" : "text"}
                      className={inputCls}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function parseProductSlugs(value: string): string[] {
  if (!value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((slug) => String(slug).trim()).filter(Boolean).slice(0, 3);
    }
  } catch {
    return value.split(",").map((slug) => slug.trim()).filter(Boolean).slice(0, 3);
  }
  return [];
}

function parseHeroImageUrls(value: string): string[] {
  if (!value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((src) => String(src).trim()).slice(0, 12);
    }
  } catch {
    return value
      .split(/[\n,]/)
      .map((src) => src.trim())
      .filter(Boolean)
      .slice(0, 12);
  }
  return [];
}

function parseHeroSlides(value: string): HeroSlideDraft[] {
  if (!value.trim()) return DEFAULT_HERO_SLIDES;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const slides = parsed
        .map((slide) => {
          if (!slide || typeof slide !== "object") return null;
          const record = slide as Record<string, unknown>;
          return {
            image: String(record.image ?? "").trim(),
            title_en: String(record.title_en ?? "").trim(),
            title_ar: String(record.title_ar ?? "").trim(),
            subtitle_en: String(record.subtitle_en ?? "").trim(),
            subtitle_ar: String(record.subtitle_ar ?? "").trim(),
            cta_en: String(record.cta_en ?? "").trim(),
            cta_ar: String(record.cta_ar ?? "").trim(),
            href: String(record.href ?? "").trim(),
          };
        })
        .filter((slide): slide is HeroSlideDraft => Boolean(slide))
        .slice(0, 8);
      if (slides.length > 0) return slides;
    }
  } catch {}
  return DEFAULT_HERO_SLIDES;
}

function HeroImagesEditor({
  value,
  lang,
  onChange,
}: {
  value: string;
  lang: "en" | "ar";
  onChange: (value: string) => void;
}) {
  const ar = lang === "ar";
  const parsedImages = parseHeroImageUrls(value);
  const images = parsedImages.length > 0 ? parsedImages : DEFAULT_HERO_IMAGES;

  function commit(nextImages: string[]) {
    onChange(JSON.stringify(nextImages.slice(0, 12)));
  }

  function updateImage(index: number, src: string) {
    commit(images.map((image, i) => (i === index ? src : image)));
  }

  function removeImage(index: number) {
    if (images.length <= 1) return;
    commit(images.filter((_, i) => i !== index));
  }

  return (
    <div className="rounded-xl border border-border bg-white/60 p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {images.map((src, index) => (
          <div key={`${index}-${src || "empty"}`} className="relative rounded-xl border border-border bg-white p-2">
            <ImageUpload
              value={src}
              onChange={(nextSrc) => updateImage(index, nextSrc)}
              label={`${ar ? "صورة" : "Image"} ${index + 1}`}
              lang={lang}
              aspectRatio={1}
            />
            {images.length > 1 && (
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-500/10"
              >
                <X size={12} />
                {ar ? "حذف" : "Remove"}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-fg-dim">
          {ar
            ? "تظهر هذه الصور في كروت المنتجات المتحركة داخل الهيرو."
            : "These images rotate in the hero product cards."}
        </p>
        <button
          type="button"
          onClick={() => commit([...images, ""])}
          disabled={images.length >= 12}
          className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ar ? "إضافة صورة" : "Add image"}
        </button>
      </div>
    </div>
  );
}

function HeroSlidesEditor({
  value,
  lang,
  products,
  categories,
  onChange,
}: {
  value: string;
  lang: "en" | "ar";
  products: ProductOption[];
  categories: CategoryOption[];
  onChange: (value: string) => void;
}) {
  const ar = lang === "ar";
  const slides = parseHeroSlides(value);
  const activeProducts = products.filter((product) => product.is_active);

  function commit(nextSlides: HeroSlideDraft[]) {
    onChange(JSON.stringify(nextSlides.slice(0, 8)));
  }

  function updateSlide(index: number, patch: Partial<HeroSlideDraft>) {
    commit(slides.map((slide, slideIndex) => (
      slideIndex === index ? { ...slide, ...patch } : slide
    )));
  }

  function removeSlide(index: number) {
    if (slides.length <= 1) return;
    commit(slides.filter((_, slideIndex) => slideIndex !== index));
  }

  function addSlide() {
    commit([
      ...slides,
      {
        ...DEFAULT_HERO_SLIDES[0],
        image: "",
        title_en: "",
        title_ar: "",
        subtitle_en: "",
        subtitle_ar: "",
      },
    ]);
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-white/60 p-3">
      {slides.map((slide, index) => (
        <div key={`${index}-${slide.image || "empty"}`} className="rounded-2xl border border-border bg-white p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-fg">
              {ar ? `الشريحة ${index + 1}` : `Slide ${index + 1}`}
            </h3>
            {slides.length > 1 && (
              <button
                type="button"
                onClick={() => removeSlide(index)}
                className="flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-500/10"
              >
                <X size={12} />
                {ar ? "حذف الشريحة" : "Remove slide"}
              </button>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <ImageUpload
              value={slide.image}
              onChange={(nextImage) => updateSlide(index, { image: nextImage })}
              label={ar ? "صورة الشريحة" : "Slide image"}
              lang={lang}
              aspectRatio={16 / 9}
            />

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[11px] text-fg-dim/70">
                  {ar ? "رابط الزر" : "Button link"}
                </span>
                <select
                  value={slide.href}
                  onChange={(event) => updateSlide(index, { href: event.target.value })}
                  className={inputCls}
                >
                  <option value="#bestsellers">
                    {ar ? "الأكثر مبيعاً" : "Best sellers section"}
                  </option>
                  <optgroup label={ar ? "الأقسام" : "Categories"}>
                    {categories.map((category) => (
                      <option key={category.id} value={`/category/${category.slug}`}>
                        {ar ? category.name_ar : category.name_en}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={ar ? "المنتجات" : "Products"}>
                    {activeProducts.map((product) => (
                      <option key={product.id} value={`/product/${product.slug}`}>
                        {ar ? product.name_ar : product.name_en}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] text-fg-dim/70">English Title</span>
                  <input
                    value={slide.title_en}
                    onChange={(event) => updateSlide(index, { title_en: event.target.value })}
                    className={inputCls}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] text-fg-dim/70">العنوان الرئيسي</span>
                  <input
                    value={slide.title_ar}
                    onChange={(event) => updateSlide(index, { title_ar: event.target.value })}
                    dir="rtl"
                    className={inputCls}
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] text-fg-dim/70">English Subtitle</span>
                  <textarea
                    value={slide.subtitle_en}
                    onChange={(event) => updateSlide(index, { subtitle_en: event.target.value })}
                    className={`${inputCls} min-h-24 resize-y`}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] text-fg-dim/70">العنوان الفرعي</span>
                  <textarea
                    value={slide.subtitle_ar}
                    onChange={(event) => updateSlide(index, { subtitle_ar: event.target.value })}
                    dir="rtl"
                    className={`${inputCls} min-h-24 resize-y`}
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] text-fg-dim/70">English CTA</span>
                  <input
                    value={slide.cta_en}
                    onChange={(event) => updateSlide(index, { cta_en: event.target.value })}
                    className={inputCls}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] text-fg-dim/70">نص الزر</span>
                  <input
                    value={slide.cta_ar}
                    onChange={(event) => updateSlide(index, { cta_ar: event.target.value })}
                    dir="rtl"
                    className={inputCls}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-fg-dim">
          {ar
            ? "كل شريحة تقدر تغير صورتها ونصوصها ورابط الزر من هنا."
            : "Each slide has its own image, copy, and button link."}
        </p>
        <button
          type="button"
          onClick={addSlide}
          disabled={slides.length >= 8}
          className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ar ? "إضافة شريحة" : "Add slide"}
        </button>
      </div>
    </div>
  );
}

function ProductMultiPicker({
  value,
  products,
  lang,
  onChange,
}: {
  value: string;
  products: ProductOption[];
  lang: "en" | "ar";
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const ar = lang === "ar";
  const selectedSlugs = parseProductSlugs(value);
  const selectedProducts = selectedSlugs
    .map((slug) => products.find((product) => product.slug === slug))
    .filter((product): product is ProductOption => Boolean(product));
  const normalizedQuery = query.trim().toLowerCase();
  const filteredProducts = products
    .filter((product) => product.is_active)
    .filter((product) => {
      if (!normalizedQuery) return true;
      return [product.name_en, product.name_ar, product.slug].some((item) =>
        item.toLowerCase().includes(normalizedQuery),
      );
    })
    .slice(0, 8);

  function commit(slugs: string[]) {
    onChange(JSON.stringify(slugs.slice(0, 3)));
  }

  function add(slug: string) {
    if (selectedSlugs.includes(slug) || selectedSlugs.length >= 3) return;
    commit([...selectedSlugs, slug]);
  }

  function remove(slug: string) {
    commit(selectedSlugs.filter((selectedSlug) => selectedSlug !== slug));
  }

  return (
    <div className="rounded-xl border border-border bg-white/60 p-3">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-dim" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={ar ? "ابحث عن منتج" : "Search products"}
          className={`${inputCls} pl-9`}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {selectedProducts.map((product) => (
          <button
            key={product.slug}
            type="button"
            onClick={() => remove(product.slug)}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium text-brand"
          >
            {ar ? product.name_ar : product.name_en}
            <X size={12} />
          </button>
        ))}
        <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-fg-dim">
          {selectedSlugs.length}/3
        </span>
      </div>

      <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-border bg-white">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product) => {
            const selected = selectedSlugs.includes(product.slug);
            const disabled = !selected && selectedSlugs.length >= 3;
            return (
              <button
                key={product.id}
                type="button"
                disabled={disabled}
                onClick={() => (selected ? remove(product.slug) : add(product.slug))}
                className="flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left transition last:border-b-0 hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? "border-brand bg-brand text-white" : "border-border"}`}>
                  {selected && <Check size={12} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">
                    {ar ? product.name_ar : product.name_en}
                  </span>
                  <span className="block truncate text-xs text-fg-dim">
                    {product.slug} · {product.price} EGP · {product.stock} stock
                  </span>
                </span>
              </button>
            );
          })
        ) : (
          <p className="px-3 py-4 text-center text-xs text-fg-dim">
            {ar ? "لا توجد منتجات" : "No products found"}
          </p>
        )}
      </div>
    </div>
  );
}
