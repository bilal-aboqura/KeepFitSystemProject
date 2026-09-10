"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Star, X } from "lucide-react";
import { useToast } from "@/components/admin/toast";
import type { AdminProductReview } from "@/lib/data/reviews";
import { cn } from "@/lib/utils";

type ReviewStatus = AdminProductReview["status"];

export function ReviewManager({
  initialReviews,
  lang,
}: {
  initialReviews: AdminProductReview[];
  lang: "en" | "ar";
}) {
  const ar = lang === "ar";
  const toast = useToast();
  const [reviews, setReviews] = useState(initialReviews);
  const [filter, setFilter] = useState<"all" | ReviewStatus>("pending");
  const [updating, setUpdating] = useState<string | null>(null);
  const visibleReviews = useMemo(
    () => reviews.filter((review) => filter === "all" || review.status === filter),
    [filter, reviews],
  );

  async function moderate(id: string, status: "approved" | "rejected") {
    setUpdating(id);
    try {
      const response = await fetch("/api/admin/reviews", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(typeof result?.error === "string" ? result.error : "Update failed");
      }
      setReviews((current) =>
        current.map((review) =>
          review.id === id
            ? { ...review, status, moderated_at: new Date().toISOString() }
            : review,
        ),
      );
      toast.success(
        status === "approved"
          ? ar
            ? "تم اعتماد التقييم ونشره."
            : "Review approved and published."
          : ar
            ? "تم رفض التقييم."
            : "Review rejected.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((status) => {
          const count = status === "all" ? reviews.length : reviews.filter((review) => review.status === status).length;
          const label = statusLabels[status][lang];
          return (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-medium transition",
                filter === status
                  ? "border-brand bg-brand text-white"
                  : "border-border bg-white text-fg-muted hover:border-border-hover hover:text-fg",
              )}
            >
              {label} · {count}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-3">
        {visibleReviews.length ? (
          visibleReviews.map((review) => (
            <article key={review.id} className="rounded-2xl border border-border bg-white p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={review.status} lang={lang} />
                    <div className="flex text-brand" aria-label={`${review.rating} / 5`}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} size={14} className={cn(star <= review.rating && "fill-current")} />
                      ))}
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-fg">{review.reviewer_name}</p>
                  <p className="mt-0.5 text-xs text-fg-dim">
                    {new Date(review.created_at).toLocaleString(ar ? "ar-EG" : "en-GB")}
                  </p>
                  {review.products ? (
                    <Link href={`/product/${review.products.slug}`} className="mt-2 inline-flex text-sm font-medium text-brand hover:underline">
                      {ar ? review.products.name_ar : review.products.name_en}
                    </Link>
                  ) : (
                    <span className="mt-2 inline-flex text-sm text-fg-dim">
                      {ar ? "منتج محذوف" : "Deleted product"}
                    </span>
                  )}
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={updating === review.id || review.status === "approved"}
                    onClick={() => void moderate(review.id, "approved")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-45"
                  >
                    {updating === review.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    {ar ? "اعتماد" : "Approve"}
                  </button>
                  <button
                    type="button"
                    disabled={updating === review.id || review.status === "rejected"}
                    onClick={() => void moderate(review.id, "rejected")}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-45"
                  >
                    <X size={15} />
                    {ar ? "رفض" : "Reject"}
                  </button>
                </div>
              </div>

              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                {review.title ? <h2 className="font-semibold text-fg">{review.title}</h2> : null}
                <p className={cn("whitespace-pre-line text-sm leading-7 text-fg-muted", review.title && "mt-2")}>{review.body}</p>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center text-sm text-fg-dim">
            {ar ? "لا توجد تقييمات في هذه الحالة." : "There are no reviews in this state."}
          </div>
        )}
      </div>
    </div>
  );
}

const statusLabels = {
  all: { en: "All", ar: "الكل" },
  pending: { en: "Pending", ar: "قيد المراجعة" },
  approved: { en: "Approved", ar: "معتمد" },
  rejected: { en: "Rejected", ar: "مرفوض" },
};

function StatusPill({ status, lang }: { status: ReviewStatus; lang: "en" | "ar" }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
        status === "approved" && "bg-emerald-50 text-emerald-700",
        status === "pending" && "bg-amber-50 text-amber-700",
        status === "rejected" && "bg-red-50 text-red-700",
      )}
    >
      {statusLabels[status][lang]}
    </span>
  );
}
