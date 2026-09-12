import pg from "pg";

const connectionString = process.env.DIRECT_URL;
const remove = process.argv.includes("--remove");
const categorySlug = "test-feature-001-002";
const legacyPrefix = "test-f001-002-";

if (!connectionString) {
  console.error("DIRECT_URL is required. Run with --env-file=.env.local");
  process.exit(1);
}

const products = [
  {
    legacyId: `${legacyPrefix}basic-wash`,
    slug: "test-f001-002-basic-wash",
    sku: "TEST-F001002-WASH",
    nameEn: "[TEST ONLY] Basic Wash",
    nameAr: "[اختبار فقط] غسيل أساسي",
    descriptionEn: "Temporary regression product for customer identity and checkout testing. Not production catalog data.",
    descriptionAr: "منتج مؤقت لاختبار هوية العميل وإتمام الطلب. ليس من بيانات الكتالوج الإنتاجية.",
    price: 100,
    stock: 100,
    image: "/images/carcare.webp",
  },
  {
    legacyId: `${legacyPrefix}account`,
    slug: "test-f001-002-customer-account",
    sku: "TEST-F001002-ACCOUNT",
    nameEn: "[TEST ONLY] Customer Account Product",
    nameAr: "[اختبار فقط] منتج حساب العميل",
    descriptionEn: "Temporary product for authenticated-customer order ownership tests. Not production catalog data.",
    descriptionAr: "منتج مؤقت لاختبار ملكية طلبات العميل المسجل. ليس من بيانات الكتالوج الإنتاجية.",
    price: 175,
    stock: 100,
    image: "/images/dashboard-1l.webp",
  },
  {
    legacyId: `${legacyPrefix}commercial`,
    slug: "test-f001-002-commercial-access",
    sku: "TEST-F001002-COMMERCIAL",
    nameEn: "[TEST ONLY] Commercial Access Product",
    nameAr: "[اختبار فقط] منتج الوصول التجاري",
    descriptionEn: "Temporary product for customer-type request regression. It has no type-specific pricing or variants.",
    descriptionAr: "منتج مؤقت لاختبار طلبات نوع العميل ولا يحتوي أسعارًا خاصة أو متغيرات.",
    price: 250,
    stock: 100,
    image: "/images/candy.webp",
  },
  {
    legacyId: `${legacyPrefix}checkout`,
    slug: "test-f001-002-checkout-regression",
    sku: "TEST-F001002-CHECKOUT",
    nameEn: "[TEST ONLY] Checkout Regression Product",
    nameAr: "[اختبار فقط] منتج اختبار إتمام الطلب",
    descriptionEn: "Temporary product for guest and authenticated COD/card checkout testing. Not production catalog data.",
    descriptionAr: "منتج مؤقت لاختبار طلبات الزائر والعميل بالدفع النقدي والبطاقة. ليس منتجًا إنتاجيًا.",
    price: 499.99,
    stock: 100,
    image: "/images/carpet.webp",
  },
];

const db = new pg.Client({ connectionString, connectionTimeoutMillis: 10_000 });
await db.connect();

try {
  await db.query("begin");
  await db.query("select pg_advisory_xact_lock(1001002)");

  if (remove) {
    const deleted = await db.query(
      "delete from public.products where legacy_id like $1 returning id",
      [`${legacyPrefix}%`],
    );
    await db.query(
      `delete from public.categories
       where slug = $1
         and not exists (select 1 from public.products where category_id = categories.id)`,
      [categorySlug],
    );
    await db.query("commit");
    console.log(`Removed ${deleted.rowCount} Feature 001/002 test products.`);
  } else {
    const category = await db.query(
      `insert into public.categories (slug, name_en, name_ar, image, sort_order)
       values ($1, '[TEST ONLY] Feature 001/002', '[اختبار فقط] الميزة 001/002', '/images/carcare.webp', 9999)
       on conflict (slug) do update
       set name_en = excluded.name_en,
           name_ar = excluded.name_ar,
           image = excluded.image,
           sort_order = excluded.sort_order
       returning id`,
      [categorySlug],
    );

    for (const product of products) {
      await db.query(
        `insert into public.products
          (legacy_id, slug, sku, category_id, name_en, name_ar,
           short_desc_en, short_desc_ar, long_desc_en, long_desc_ar,
           price, stock, is_active, is_featured, images, weight)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $7, $8, $9, $10, true, false, $11, null)
         on conflict (legacy_id) do update
         set slug = excluded.slug,
             sku = excluded.sku,
             category_id = excluded.category_id,
             name_en = excluded.name_en,
             name_ar = excluded.name_ar,
             short_desc_en = excluded.short_desc_en,
             short_desc_ar = excluded.short_desc_ar,
             long_desc_en = excluded.long_desc_en,
             long_desc_ar = excluded.long_desc_ar,
             price = excluded.price,
             stock = excluded.stock,
             is_active = true,
             is_featured = false,
             images = excluded.images`,
        [
          product.legacyId,
          product.slug,
          product.sku,
          category.rows[0].id,
          product.nameEn,
          product.nameAr,
          product.descriptionEn,
          product.descriptionAr,
          product.price,
          product.stock,
          [product.image],
        ],
      );
    }

    const verification = await db.query(
      `select sku, name_en, price, stock, is_active, is_featured
       from public.products
       where legacy_id like $1
       order by sku`,
      [`${legacyPrefix}%`],
    );
    if (verification.rowCount !== products.length) {
      throw new Error(`Expected ${products.length} test products, found ${verification.rowCount}.`);
    }
    await db.query("commit");
    console.log(`Seeded ${products.length} clearly marked Feature 001/002 test products.`);
    console.table(verification.rows);
    console.log("Remove them with: npm run remove:test-products");
  }
} catch (error) {
  await db.query("rollback");
  console.error("Test-product operation rolled back:", error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
