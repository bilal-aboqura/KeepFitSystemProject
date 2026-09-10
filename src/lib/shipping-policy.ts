function normalize(value: string) {
  return value.normalize("NFKC").toLowerCase()
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي")
    .replace(/\s+/g, " ").trim();
}

const excluded = new Set([
  "الفيوم", "بني سويف", "المنيا", "أسيوط", "سوهاج", "قنا", "الأقصر",
  "أسوان", "البحر الأحمر", "الوادي الجديد", "شمال سيناء", "جنوب سيناء",
].map(normalize));

export function is450MlDestination(governorate: string) {
  return Boolean(governorate.trim()) && !excluded.has(normalize(governorate));
}

export function is450MlProduct(product: {
  weight: string | null;
  name_en: string;
  name_ar: string;
}) {
  // An explicit catalog size takes precedence over the marketing name.
  const size = product.weight?.trim();
  const text = normalize(size || `${product.name_en} ${product.name_ar}`);
  return /(?:^|[^\d.])450\s*(?:ml|مل)(?=$|[^\p{L}\p{N}])/u.test(text);
}
