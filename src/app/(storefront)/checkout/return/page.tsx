import { redirect } from "next/navigation";

/**
 * Kashier redirects here after payment with ?orderId=...&status=...
 * The webhook is the source of truth; this just routes to the confirmation.
 */
export default async function CheckoutReturn({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const orderNumber = sp.orderId ?? "";
  redirect(`/checkout/success?order=${orderNumber}`);
}
