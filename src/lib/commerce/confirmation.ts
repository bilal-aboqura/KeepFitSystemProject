import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { resolveCommerceContext } from "./context";
import { CommerceError } from "./errors";

function mapConfirmationError(message?: string) {
  if (message?.includes("QUOTE_NOT_FOUND")) return new CommerceError("QUOTE_NOT_FOUND");
  if (message?.includes("QUOTE_EXPIRED")) return new CommerceError("QUOTE_EXPIRED");
  if (message?.includes("QUOTE_REVISION_CONFLICT")) return new CommerceError("QUOTE_REVISION_CONFLICT");
  if (message?.includes("QUOTE_INVALID")) return new CommerceError("QUOTE_INVALID");
  return new CommerceError("CHECKOUT_UNAVAILABLE");
}

export async function confirmCheckoutQuote(quoteId: string, revision: number) {
  const context = await resolveCommerceContext();
  if (context.scopeKind === "guest" && !context.guestContextHash) throw new CommerceError("QUOTE_NOT_FOUND");
  const db = getSupabaseServiceClient();
  if (!db) throw new CommerceError("CHECKOUT_UNAVAILABLE");
  const { data, error } = await db.rpc("commerce_confirm_quote", {
    p_scope_kind: context.scopeKind,
    p_customer_id: context.customerId,
    p_guest_context_hash: context.guestContextHash,
    p_quote_id: quoteId,
    p_revision: revision,
  });
  if (error || !data) throw mapConfirmationError(error?.message);
  return data as { quoteId: string; revision: number; state: "confirmed"; confirmedAt: string; expiresAt: string };
}
