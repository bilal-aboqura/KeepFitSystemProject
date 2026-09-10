"use client";

import { useState } from "react";
import { CheckCircle, Loader2, MessageSquareText, Star } from "lucide-react";
import type { ProductReview } from "@/lib/data/reviews";
import { cn } from "@/lib/utils";

export function ProductReviews({
  productId,
  reviews,
  lang,
}: {
  productId: string;
  reviews: ProductReview[];
  lang: "en" | "ar";
}) {
  const ar = lang === "ar";
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  async function submitReview(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          reviewer_name: name,
          rating,
          title: title || undefined,
          body,
          website: "",
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(typeof result?.error === "string" ? result.error : "Review failed");
      }
      setSubmitted(true);
      setName("");
      setTitle("");
      setBody("");
      setRating(5);
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : ar
            ? "تعذر إرسال التقييم."
            : "Could not submit your review.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-16 border-t border-border pt-12" aria-labelledby="product-reviews-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="product-reviews-title" className="font-heading text-2xl font-bold text-fg">
            {ar ? "تقييمات العملاء" : "Customer reviews"}
          </h2>
          <p className="mt-1 text-sm text-fg-dim">
            {reviews.length
              ? ar
                ? `${average.toFixed(1)} من 5 بناءً على ${reviews.length} تقييم`
                : `${average.toFixed(1)} out of 5 from ${reviews.length} review${reviews.length === 1 ? "" : "s"}`
              : ar
                ? "كن أول من يقيّم هذا المنتج."
                : "Be the first to review this product."}
          </p>
        </div>
        {reviews.length ? <Stars value={Math.round(average)} size={20} /> : null}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className="space-y-4">
          {reviews.length ? (
            reviews.map((review) => (
              <article key={review.id} className="rounded-2xl border border-border bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-fg">{review.reviewer_name}</p>
                    <p className="text-xs text-fg-dim">
                      {new Date(review.created_at).toLocaleDateString(ar ? "ar-EG" : "en-GB")}
                    </p>
                  </div>
                  <Stars value={review.rating} size={15} />
                </div>
                {review.title ? <h3 className="mt-4 font-semibold text-fg">{review.title}</h3> : null}
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-fg-muted">{review.body}</p>
              </article>
            ))
          ) : (
            <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center text-sm text-fg-dim">
              <div>
                <MessageSquareText className="mx-auto mb-3 text-brand" size={24} />
                {ar ? "لا توجد تقييمات منشورة حتى الآن." : "No published reviews yet."}
              </div>
            </div>
          )}
        </div>

        <form onSubmit={submitReview} className="h-fit rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h3 className="text-lg font-bold text-fg">{ar ? "أضف تقييمك" : "Write a review"}</h3>
          <p className="mt-1 text-xs leading-5 text-fg-dim">
            {ar ? "سيظهر تقييمك بعد مراجعته واعتماده." : "Your review will appear after moderation."}
          </p>

          {submitted ? (
            <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle size={17} />
                {ar ? "تم إرسال تقييمك للمراجعة." : "Your review was submitted for moderation."}
              </div>
              <button type="button" onClick={() => setSubmitted(false)} className="mt-3 text-xs underline underline-offset-2">
                {ar ? "أرسل تقييمًا آخر" : "Submit another review"}
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div>
                <span className="mb-2 block text-xs font-semibold text-fg-muted">{ar ? "التقييم" : "Rating"}</span>
                <div className="flex gap-1" role="radiogroup" aria-label={ar ? "التقييم من 5" : "Rating out of 5"}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={rating === value}
                      aria-label={`${value} / 5`}
                      onClick={() => setRating(value)}
                      className="rounded-md p-1 text-brand transition hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <Star size={22} className={cn(value <= rating && "fill-current")} />
                    </button>
                  ))}
                </div>
              </div>
              <Field label={ar ? "الاسم" : "Name"}>
                <input required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="input" />
              </Field>
              <Field label={ar ? "عنوان التقييم (اختياري)" : "Review title (optional)"}>
                <input maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} className="input" />
              </Field>
              <Field label={ar ? "اكتب تجربتك" : "Your experience"}>
                <textarea required minLength={10} maxLength={1500} rows={5} value={body} onChange={(event) => setBody(event.target.value)} className="input resize-y" />
              </Field>
              {error ? <p className="text-sm text-brand">{error}</p> : null}
              <button type="submit" disabled={submitting} className="btn btn-primary w-full">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                {submitting ? (ar ? "جارٍ الإرسال..." : "Submitting...") : ar ? "إرسال التقييم" : "Submit review"}
              </button>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}

function Stars({ value, size }: { value: number; size: number }) {
  return (
    <div className="flex gap-0.5 text-brand" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} size={size} className={cn(star <= value && "fill-current")} />
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-fg-muted">{label}</span>
      {children}
    </label>
  );
}
