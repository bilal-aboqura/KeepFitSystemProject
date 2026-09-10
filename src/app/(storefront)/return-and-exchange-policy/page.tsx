import { getLang } from "@/lib/i18n/server";
import { LegalPage } from "@/components/storefront/legal-page";

export default async function ReturnAndExchangePolicyPage() {
  const lang = await getLang();
  const ar = lang === "ar";

  const sections = ar
    ? [
        {
          title: "مدة الاستبدال والاسترجاع",
          body: [
            "يمكنك طلب استبدال أو استرجاع المنتجات خلال 7 أيام من تاريخ الاستلام، بشرط أن تكون العبوة بحالتها الأصلية والمنتج غير مستخدم.",
            "لا تنطبق سياسة الاسترجاع على المنتجات المفتوحة أو المستخدمة، إلا إذا كان هناك عيب تصنيع أو خطأ في الطلب.",
          ],
        },
        {
          title: "الحالات المقبولة",
          body: [
            "نقبل طلبات الاستبدال أو الاسترجاع في حالة وصول منتج مختلف عن المطلوب، أو وجود تلف ظاهر، أو وجود عيب في التصنيع.",
            "قد نطلب صورًا للمنتج أو الشحنة للمراجعة السريعة قبل ترتيب الاستلام أو الاستبدال.",
          ],
        },
        {
          title: "خطوات الطلب",
          body: [
            "لطلب الاستبدال أو الاسترجاع، تواصل معنا عبر رقم الموبايل أو البريد الإلكتروني مع رقم الطلب وسبب الطلب.",
            "بعد مراجعة الحالة، سننسق معك طريقة الاستلام أو التسليم البديل، مع توضيح أي رسوم شحن إن وجدت بحسب سبب الطلب.",
          ],
        },
        {
          title: "استرداد المبلغ",
          body: [
            "بعد استلام المنتج وفحصه، يتم تأكيد الاستحقاق ثم بدء إجراءات استرداد المبلغ بنفس وسيلة الدفع المتاحة أو بالطريقة المتفق عليها مع العميل.",
            "إذا كان سبب الاسترجاع خطأ من جانبنا أو عيب في المنتج، تتحمل Xeemo رسوم الشحن المرتبطة بعملية الاسترجاع أو الاستبدال.",
          ],
        },
      ]
    : [
        {
          title: "Return and exchange window",
          body: [
            "You may request a return or exchange within 7 days of receiving your order, provided the item remains unused and in its original packaging.",
            "Opened or used products are not eligible for return unless there is a manufacturing defect or a confirmed order error.",
          ],
        },
        {
          title: "Eligible cases",
          body: [
            "Returns or exchanges are accepted when you receive the wrong product, when the shipment arrives visibly damaged, or when the item has a manufacturing defect.",
            "We may request product or package photos to review the case quickly before arranging pickup or replacement.",
          ],
        },
        {
          title: "How to request",
          body: [
            "To request a return or exchange, contact us using the mobile number or email address listed below and include your order number and the reason for the request.",
            "After review, we will coordinate pickup or replacement and clarify any shipping charges if they apply based on the case.",
          ],
        },
        {
          title: "Refund processing",
          body: [
            "Once the returned item is received and inspected, we will confirm eligibility and begin the refund process using the available payment method or another agreed method.",
            "If the issue was caused by our error or a product defect, Xeemo will cover the related return or exchange shipping costs.",
          ],
        },
      ];

  return (
    <LegalPage
      eyebrow={ar ? "خدمة العملاء" : "Customer Care"}
      title={ar ? "سياسة الاستبدال والاسترجاع" : "Exchange & Return Policy"}
      intro={
        ar
          ? "نحرص أن تكون تجربة الشراء آمنة وواضحة. هذه السياسة توضح متى وكيف يمكنك طلب استبدال أو استرجاع أي منتج تم شراؤه من Xeemo."
          : "We want every purchase to feel safe and straightforward. This policy explains when and how you can request an exchange or return for products purchased from Xeemo."
      }
      sections={sections}
      note={
        ar
          ? "شاركنا رقم الطلب وسنساعدك في أسرع وقت ممكن."
          : "Share your order number with us and we will help as quickly as possible."
      }
    />
  );
}
