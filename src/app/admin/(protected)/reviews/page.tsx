import { AdminPageHeader } from "@/components/admin/page-header";
import { ReviewManager } from "@/components/admin/review-manager";
import { adminListProductReviews } from "@/lib/data/reviews";
import { getLang } from "@/lib/i18n/server";

export default async function AdminReviewsPage() {
  const [lang, reviews] = await Promise.all([
    getLang(),
    adminListProductReviews(),
  ]);
  const ar = lang === "ar";
  const pending = reviews.filter((review) => review.status === "pending").length;

  return (
    <div>
      <AdminPageHeader
        eyebrow={ar ? "محتوى العملاء" : "Customer content"}
        title={ar ? "تقييمات المنتجات" : "Product reviews"}
        description={
          ar
            ? `راجع التقييمات قبل نشرها. يوجد ${pending} تقييم بانتظار قرارك.`
            : `Moderate reviews before they are published. ${pending} review${pending === 1 ? " is" : "s are"} waiting.`
        }
      />
      <ReviewManager initialReviews={reviews} lang={lang} />
    </div>
  );
}
