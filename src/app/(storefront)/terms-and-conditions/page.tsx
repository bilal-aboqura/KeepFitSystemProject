import { getLang } from "@/lib/i18n/server";
import { LegalPage } from "@/components/storefront/legal-page";

export default async function TermsAndConditionsPage() {
  const lang = await getLang();
  const ar = lang === "ar";

  const sections = ar
    ? [
        {
          title: "استخدام الموقع والطلبات",
          body: [
            "باستخدامك لموقع Xeemo أو إتمام أي طلب، فأنت توافق على الالتزام بهذه الشروط والأحكام وكل السياسات المرتبطة بها داخل الموقع.",
            "يجب أن تكون بيانات الطلب صحيحة وكاملة، بما يشمل الاسم ورقم الهاتف والعنوان، حتى نتمكن من تأكيد الطلب وتسليمه بشكل صحيح.",
          ],
        },
        {
          title: "الأسعار وتأكيد الطلب",
          body: [
            "جميع الأسعار المعروضة بالموقع بالجنيه المصري، وقد يتم تحديثها أو تعديل العروض في أي وقت دون إشعار مسبق حتى يتم تأكيد الطلب.",
            "يعتبر الطلب قيد المراجعة إلى أن يتم التواصل مع العميل وتأكيد تفاصيل التوصيل وتوفر المنتج.",
          ],
        },
        {
          title: "التوصيل والاستلام",
          body: [
            "نلتزم ببذل أفضل جهد لتسليم الطلبات خلال المدة المتوقعة، لكن قد تختلف مواعيد التسليم بحسب المحافظة أو شركة الشحن أو ظروف التشغيل.",
            "يرجى مراجعة المنتج عند الاستلام، وفي حال وجود مشكلة ظاهرة في الشحنة يجب إبلاغنا فورًا عبر الهاتف أو البريد الإلكتروني أو واتساب.",
          ],
        },
        {
          title: "المحتوى والملكية",
          body: [
            "جميع النصوص والصور والشعارات والمحتوى المعروض على الموقع مملوك لـ Xeemo أو مرخص له، ولا يجوز إعادة استخدامه أو نسخه تجاريًا دون موافقة مسبقة.",
            "نحتفظ بالحق في تحديث المحتوى أو تعديل المنتجات أو إيقاف أي منتج أو خدمة دون التزام مسبق.",
          ],
        },
      ]
    : [
        {
          title: "Website use and orders",
          body: [
            "By using the Xeemo website or placing an order, you agree to these terms and conditions and the related policies published on the site.",
            "Order details must be accurate and complete, including your name, mobile number, and address, so we can confirm and deliver your order correctly.",
          ],
        },
        {
          title: "Pricing and order confirmation",
          body: [
            "All prices shown on the website are in Egyptian Pounds. Prices and promotions may change at any time before an order is confirmed.",
            "An order remains pending review until our team confirms product availability and delivery details with the customer.",
          ],
        },
        {
          title: "Delivery and receipt",
          body: [
            "We make every reasonable effort to deliver within the expected timeframe, but delivery dates may vary based on location, courier performance, or operational conditions.",
            "Please inspect the shipment upon receipt. If there is any visible issue, contact us immediately by phone, email, or WhatsApp.",
          ],
        },
        {
          title: "Content and ownership",
          body: [
            "All website content, including text, images, branding, and design assets, belongs to Xeemo or is licensed for use and may not be reused commercially without permission.",
            "We reserve the right to update content, change product details, or discontinue products or services at any time.",
          ],
        },
      ];

  return (
    <LegalPage
      eyebrow={ar ? "سياسات المتجر" : "Store Policies"}
      title={ar ? "الشروط والأحكام" : "Terms & Conditions"}
      intro={
        ar
          ? "هذه الشروط تنظم استخدامك لموقع Xeemo وعمليات الشراء من خلاله. هدفنا أن تكون العلاقة واضحة وشفافة من لحظة التصفح حتى استلام الطلب."
          : "These terms govern your use of the Xeemo website and any purchase made through it. They are designed to keep the relationship clear and transparent from browsing to delivery."
      }
      sections={sections}
      note={
        ar
          ? "لو محتاج توضيح لأي نقطة قبل الطلب، فريقنا جاهز يساعدك."
          : "If you need clarification on any point before ordering, our team is ready to help."
      }
    />
  );
}
