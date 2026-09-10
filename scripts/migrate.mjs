// ============================================================================
// Phase 2 migration: applies supabase/schema.sql then seeds catalog/locations.
// Run:  node --env-file=.env.local scripts/migrate.mjs
// Idempotent (upserts / truncates seed-only tables).
// ============================================================================
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Client } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORIGINAL = path.resolve(__dirname, "../../"); // D:\XemoMainWebSite

const connectionString = process.env.DIRECT_URL;
if (!connectionString) {
  console.error("✗ DIRECT_URL is missing. Run with --env-file=.env.local");
  process.exit(1);
}

// -- Source data -------------------------------------------------------------
const CATEGORY_FILES = [
  { file: "montgat.json", slug: "carcare", en: "Car Care", ar: "عناية السيارات", image: "/images/carcare.webp" },
  { file: "montgatw.json", slug: "motocare", en: "Moto Care", ar: "عناية الموتوسيكلات", image: "/images/motocare.webp" },
  { file: "montgatk.json", slug: "carpets", en: "Carpets & Furniture", ar: "السجاد والأثاث", image: "/images/carpetscare.webp" },
  { file: "montgataf.json", slug: "air-freshener", en: "Air Freshener", ar: "معطر الجو", image: null },
  { file: null, slug: "home-care", en: "Home Care", ar: "العناية بالمنزل", image: "/images/home-care.jpeg" },
];

// Governorate Arabic → English
const GOV_EN = {
  "القاهرة": "Cairo", "الجيزة": "Giza", "الإسكندرية": "Alexandria",
  "الدقهلية": "Dakahlia", "الغربية": "Gharbia", "الشرقية": "Sharqia",
  "القليوبية": "Qalyubia", "المنوفية": "Monufia", "البحيرة": "Beheira",
  "كفر الشيخ": "Kafr El Sheikh", "الفيوم": "Faiyum", "بني سويف": "Beni Suef",
  "المنيا": "Minya", "أسيوط": "Asyut", "سوهاج": "Sohag", "قنا": "Qena",
  "الأقصر": "Luxor", "أسوان": "Aswan", "البحر الأحمر": "Red Sea",
  "السويس": "Suez", "بورسعيد": "Port Said", "دمياط": "Damietta",
  "الإسماعيلية": "Ismailia", "مطروح": "Matrouh", "شمال سيناء": "North Sinai",
  "جنوب سيناء": "South Sinai", "الوادي الجديد": "New Valley",
};

// From Scripts/cart.js (egyptLocations) — Arabic city lists per governorate.
const EGYPT_LOCATIONS = {
  "القاهرة": ["15 مايو","الأزبكية","البساتين","التبين","الخليفة","الدراسة","الدرب الأحمر","الزاوية الحمراء","الزيتون","الساحل","السلام","السيدة زينب","الشرابية","مدينة الشروق","الظاهر","العتبة","القاهرة الجديدة","المرج","عزبة النخل","المطرية","المعادي","المعصرة","المقطم","المنيل","الموسكي","النزهة","الوايلي","باب الشعرية","بولاق","جاردن سيتي","حدائق القبة","حلوان","دار السلام","شبرا","طرة","عابدين","عباسية","عين شمس","مدينة نصر","مصر الجديدة","مصر القديمة","منشية ناصر","مدينة بدر","مدينة العبور","وسط البلد","الزمالك","قصر النيل","الرحاب","القطامية","مدينتي","روض الفرج","شيراتون","الجمالية","العاشر من رمضان","الحلمية","النزهة الجديدة","العاصمة الإدارية"],
  "الجيزة": ["الجيزة","السادس من أكتوبر","الشيخ زايد","الحوامدية","البدرشين","الصف","أطفيح","العياط","الباويطي","منشأة القناطر","أوسيم","كرداسة","أبو النمرس","كفر غطاطي","منشأة البكاري","الدقي","العجوزة","الهرم","الوراق","إمبابة","بولاق الدكرور","الواحات البحرية","العمرانية","المنيب","بين السرايات","الكيت كات","المهندسين","فيصل","أبو رواش","حدائق الأهرام","الحرانية","حدائق أكتوبر","صفط اللبن","القرية الذكية","أرض اللواء"],
  "الإسكندرية": ["أبو قير","الإبراهيمية","الأزاريطة","الأنفوشي","الدخيلة","السيوف","العامرية","اللبان","المفروزة","المنتزه","المنشية","الناصرية","امبروزو","باب شرق","برج العرب","ستانلي","سموحة","سيدي بشر","شدس","غيط العنب","فلمنج","فيكتوريا","كامب شيزار","كرموز","محطة الرمل","مينا البصل","العصافرة","العجمي","بكوس","بولكلي","كليوباترا","جليم","المعمورة","المندرة","محرم بك","الشاطبي","سيدي جابر","الساحل الشمالي","الحضرة","العطارين","سيدي كرير","الجمرك","المكس","مارينا"],
  "الدقهلية": ["المنصورة","طلخا","ميت غمر","دكرنس","أجا","منية النصر","السنبلاوين","الكردي","بني عبيد","المنزلة","تمي الأمديد","الجمالية","شربين","المطرية","بلقاس","ميت سلسيل","جمصة","محلة دمنة","نبروه"],
  "الغربية": ["طنطا","المحلة الكبرى","كفر الزيات","زفتى","السنطة","قطور","بسيون","سمنود"],
  "الشرقية": ["الزقازيق","العاشر من رمضان","منيا القمح","بلبيس","مشتول السوق","القنايات","أبو حماد","القرين","ههيا","أبو كبير","فاقوس","الصالحية الجديدة","الإبراهيمية","ديرب نجم","كفر صقر","أولاد صقر","الحسينية","صان الحجر القبلية","منشأة أبو عمر"],
  "القليوبية": ["بنها","قليوب","شبرا الخيمة","القناطر الخيرية","الخانكة","كفر شكر","طوخ","قها","العبور","الخصوص","شبين القناطر","مسطرد"],
  "المنوفية": ["شبين الكوم","مدينة السادات","منوف","سرس الليان","أشمون","الباجور","قويسنا","بركة السبع","تلا","الشهداء"],
  "البحيرة": ["دمنهور","كفر الدوار","رشيد","إدكو","أبو المطامير","أبو حمص","الدلنجات","المحمودية","الرحمانية","إيتاي البارود","حوش عيسى","شبراخيت","كوم حمادة","بدر","وادي النطرون","النوبارية الجديدة","النوبارية"],
  "كفر الشيخ": ["كفر الشيخ","وسط البلد كفر الشيخ","دسوق","فوه","مطوبس","برج البرلس","بلطيم","مصيف بلطيم","الحامول","بيلا","الرياض","سيدي سالم","قلين","سيدي غازي"],
  "الفيوم": ["الفيوم","الفيوم الجديدة","طامية","سنورس","إطسا","إبشواي","يوسف الصديق","الحادقة","اطسا","الجامعة","السيالة"],
  "بني سويف": ["بني سويف","بني سويف الجديدة","الواسطى","ناصر","إهناسيا","ببا","الفشن","سمسطا","الأباصيري","مقبل"],
  "المنيا": ["المنيا","المنيا الجديدة","العدوة","مغاغة","بني مزار","مطاي","سمالوط","المدينة الفكرية","ملوي","دير مواس","أبو قرقاص","أرض سلطان"],
  "أسيوط": ["أسيوط","أسيوط الجديدة","ديروط","منفلوط","القوصية","أبنوب","أبو تيج","الغنايم","ساحل سليم","البداري","صدفا"],
  "سوهاج": ["سوهاج","سوهاج الجديدة","أخميم","أخميم الجديدة","البلينا","المراغة","المنشأة","دار السلام","جرجا","جهينة الغربية","ساقلته","طما","طهطا","الكوثر"],
  "قنا": ["قنا","قنا الجديدة","أبو طشت","نجع حمادي","دشنا","الوقف","قفط","نقادة","فرشوط","قوص"],
  "الأقصر": ["الأقصر","الأقصر الجديدة","إسنا","طيبة الجديدة","الزينية","البياضية","القرنة","أرمنت","الطود"],
  "أسوان": ["أسوان","أسوان الجديدة","دراو","كوم أمبو","نصر النوبة","كلابشة","إدفو","الرديسية","البصيلية","السباعية","أبو سمبل السياحية","مرسى علم"],
  "البحر الأحمر": ["الغردقة","رأس غارب","سفاجا","القصير","مرسى علم","الشلاتين","حلايب","الدهار"],
  "السويس": ["السويس","الجناين","عتاقة","العين السخنة","فيصل"],
  "بورسعيد": ["بورسعيد","بورفؤاد","العرب","حي الزهور","حي الشرق","حي الضواحي","حي المناخ","حي مبارك"],
  "دمياط": ["دمياط","دمياط الجديدة","رأس البر","فارسكور","الزرقا","السرو","الروضة","كفر البطيخ","عزبة البرج","ميت أبو غالب","كفر سعد"],
  "الإسماعيلية": ["الإسماعيلية","فايد","القنطرة شرق","القنطرة غرب","التل الكبير","أبو صوير","القصاصين الجديدة","نفيشة","الشيخ زايد"],
  "مطروح": ["مرسى مطروح","الحمام","العلمين","الضبعة","النجيلة","سيدي براني","السلوم","سيوة","مارينا","الساحل الشمالي"],
  "شمال سيناء": ["العريش","الشيخ زويد","نخل","رفح","بئر العبد","الحسنة"],
  "جنوب سيناء": ["الطور","شرم الشيخ","دهب","نويبع","طابا","سانت كاترين","أبو رديس","أبو زنيمة","رأس سدر"],
  "الوادي الجديد": ["الخارجة","باريس","موط","الفرافرة","بلاط","الداخلة"],
};

// From Scripts/cart.js (shippingCosts) — Arabic gov--city → EGP. Plus a global default.
const SHIPPING = {
  "الغربية--طنطا": 105, "القليوبية--بنها": 105, "القاهرة--مدينة نصر": 105,
  "الجيزة--6 أكتوبر": 105, "المنوفية--شبين الكوم": 105, "الدقهلية--المنصورة": 105,
  "كفر الشيخ--كفر الشيخ": 105, "البحيرة--دمنهور": 105, "الإسكندرية--سموحة": 105,
  "الشرقية--الزقازيق": 105, "الفيوم--الفيوم": 125, "بني سويف--بني سويف": 125,
  "المنيا--المنيا": 120, "أسيوط--أسيوط": 120, "سوهاج--سوهاج": 120, "قنا--قنا": 125,
  "الأقصر--الأقصر": 185, "أسوان--أسوان": 185, "البحر الأحمر--الغردقة": 125,
  "السويس--السويس": 115, "بورسعيد--بورسعيد": 115, "دمياط--دمياط": 105,
  "الإسماعيلية--الإسماعيلية": 105, "مطروح--مرسى مطروح": 125,
  "شمال سيناء--العريش": 125, "جنوب سيناء--شرم الشيخ": 125,
  "الوادي الجديد--الخارجة": 140,
};
const SHIPPING_GLOBAL_DEFAULT = 120;

const SETTINGS = [
  { key: "hero_title_en", en: "Premium Care for Your Ride", ar: "عناية فاخرة لسيارتك" },
  { key: "hero_sub_en", en: "Professional car, moto & carpet chemicals — made in Egypt.", ar: "كيماويات احترافية للسيارات والموتوسيكلات والسجاد — صناعة مصرية." },
  { key: "contact_whatsapp", en: "201150301033", ar: "201150301033" },
  { key: "contact_facebook", en: "https://www.facebook.com/officialxeemo", ar: "https://www.facebook.com/officialxeemo" },
  { key: "free_shipping_threshold", en: "1000", ar: "1000" },
  { key: "currency", en: "EGP", ar: "ج.م" },
];

// -- Helpers -----------------------------------------------------------------
function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function toImageUrl(img) {
  if (!img || !img.trim() || img === "../Images/") return "/images/placeholder.webp";
  const file = path.basename(img.replace(/\\/g, "/"));
  return `/images/${file}`;
}

// -- Main --------------------------------------------------------------------
async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log("✓ Connected to Postgres");

  // 1) Schema
  const schemaSql = fs.readFileSync(path.resolve(__dirname, "../supabase/schema.sql"), "utf8");
  await client.query(schemaSql);
  console.log("✓ Schema applied");

  // 2) Categories
  for (const [categoryIndex, c] of CATEGORY_FILES.entries()) {
    await client.query(
      `insert into public.categories (slug, name_en, name_ar, image, sort_order)
       values ($1,$2,$3,$4,$5)
       on conflict (slug) do update set name_en=excluded.name_en, name_ar=excluded.name_ar, image=excluded.image, sort_order=excluded.sort_order`,
      [c.slug, c.en, c.ar, c.image, categoryIndex],
    );
  }
  const { rows: cats } = await client.query("select id, slug from public.categories");
  const catBySlug = Object.fromEntries(cats.map((r) => [r.slug, r.id]));
  console.log(`✓ ${cats.length} categories`);

  // 3) Products
  let productCount = 0;
  for (const c of CATEGORY_FILES) {
    if (!c.file) continue;
    const file = path.join(ORIGINAL, "Data", c.file);
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const items = raw.products || [];
    for (const [i, p] of items.entries()) {
      const images = [toImageUrl(p.image)];
      const slug = `${slugify(p.name)}-${p.id}`;
      const longEn = p.longdescription || p.description || "";
      const longAr = p.longdescription_ar || p.description_ar || "";
      await client.query(
        `insert into public.products
         (legacy_id, slug, sku, category_id, name_en, name_ar, short_desc_en, short_desc_ar,
          long_desc_en, long_desc_ar, price, stock, is_active, is_featured, images, weight)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,$13,$14,null)
         on conflict (legacy_id) do update set
           slug=excluded.slug, category_id=excluded.category_id,
           name_en=excluded.name_en, name_ar=excluded.name_ar,
           long_desc_en=excluded.long_desc_en, long_desc_ar=excluded.long_desc_ar,
           price=excluded.price, stock=excluded.stock, is_featured=excluded.is_featured,
           images=excluded.images`,
        [
          p.id, slug, p.id.toUpperCase(), catBySlug[c.slug],
          p.name, p.name_ar, p.description || "", p.description_ar || "",
          longEn, longAr, Number(p.price) || 0, 100,
          i < 2, // featured
          images,
        ],
      );
      productCount++;
    }
  }
  console.log(`✓ ${productCount} products`);

  // 4) Locations
  await client.query("delete from public.locations");
  let locCount = 0;
  let order = 0;
  for (const [govAr, cities] of Object.entries(EGYPT_LOCATIONS)) {
    const govEn = GOV_EN[govAr] || govAr;
    for (const city of cities) {
      await client.query(
        `insert into public.locations (governorate_en, governorate_ar, city, sort_order)
         values ($1,$2,$3,$4)`,
        [govEn, govAr, city, order++],
      );
      locCount++;
    }
  }
  console.log(`✓ ${locCount} locations (${Object.keys(EGYPT_LOCATIONS).length} governorates)`);

  // 5) Shipping rates
  await client.query("delete from public.shipping_rates");
  for (const [k, cost] of Object.entries(SHIPPING)) {
    const [gov, city] = k.split("--");
    await client.query(
      `insert into public.shipping_rates (governorate, city, cost) values ($1,$2,$3)
       on conflict (governorate, city) do update set cost=excluded.cost`,
      [gov, city, cost],
    );
  }
  await client.query(
    `insert into public.shipping_rates (governorate, city, cost) values ('*','*',$1)
     on conflict (governorate, city) do update set cost=excluded.cost`,
    [SHIPPING_GLOBAL_DEFAULT],
  );
  console.log(`✓ ${Object.keys(SHIPPING).length + 1} shipping rates (incl. global default ${SHIPPING_GLOBAL_DEFAULT})`);

  // 6) Settings
  for (const s of SETTINGS) {
    await client.query(
      `insert into public.settings (key, value_en, value_ar) values ($1,$2,$3)
       on conflict (key) do update set value_en=excluded.value_en, value_ar=excluded.value_ar`,
      [s.key, s.en, s.ar],
    );
  }
  console.log(`✓ ${SETTINGS.length} settings`);

  // Summary
  const { rows: summary } = await client.query(`
    select
      (select count(*) from public.categories) as categories,
      (select count(*) from public.products) as products,
      (select count(*) from public.locations) as locations,
      (select count(*) from public.shipping_rates) as shipping_rates,
      (select count(*) from public.settings) as settings;
  `);
  console.log("\n✅ Migration complete:");
  console.table(summary[0]);

  await client.end();
}

main().catch((e) => {
  console.error("✗ Migration failed:", e);
  process.exit(1);
});
