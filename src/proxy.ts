import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 Proxy (formerly "Middleware").
 *
 * Responsibilities:
 *  - Refresh Supabase auth session cookies on every request.
 *  - Optimistic guard for /admin routes (full auth check happens server-side in
 *    the admin layout; this just avoids flashing protected UI to anonymous
 *    visitors).
 */
export async function proxy(request: NextRequest) {
  const response = await updateSession(request);

  const { pathname } = request.nextUrl;

  // Optimistic admin guard: anonymous visitors hitting /admin/* are sent to
  // /admin/login. The authoritative authz check lives in the admin layout.
  const isAdminArea = pathname.startsWith("/admin");
  const isAdminLogin = pathname === "/admin/login";
  if (isAdminArea && !isAdminLogin) {
    // Session cookies are refreshed above; presence of sb-* auth cookie is a
    // cheap signal that *some* session exists. Real validation is server-side.
    const hasSession = request.cookies
      .getAll()
      .some((c) => c.name.startsWith("sb-"));
    if (!hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  // Run on everything except static assets and Next internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)"],
};
