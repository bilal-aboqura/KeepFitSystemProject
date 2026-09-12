import "server-only";
import { createHash, randomBytes } from "node:crypto";
export function hashConfirmationSecret(secret: string) { return createHash("sha256").update(secret).digest("hex"); }
export function newConfirmationGrant() {
  const secret = randomBytes(32).toString("base64url");
  return { secret, hash: hashConfirmationSecret(secret), expiresAt: new Date(Date.now() + 30 * 86400000) };
}
export function confirmationGrantCookieName(orderNumber: string) {
  return "keepfit_order_grant_" + orderNumber;
}
export const confirmationCookieOptions = {
  httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/checkout",
};
