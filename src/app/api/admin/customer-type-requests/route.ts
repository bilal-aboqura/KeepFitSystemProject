import { NextResponse, type NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { adminCustomerTypeFiltersSchema } from "@/lib/customers/validation";
import { listAdminCustomerTypeRequests } from "@/lib/customers/type-requests";

export async function GET(request: NextRequest) {
  const auth = await requireAdminUser();
  if (auth.denied) return auth.denied;
  const search = request.nextUrl.searchParams;
  const parsed = adminCustomerTypeFiltersSchema.safeParse({
    status: search.get("status") || undefined,
    requestedType: search.get("requestedType") || undefined,
    effectiveType: search.get("effectiveType") || undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid filters" }, { status: 422 });
  return NextResponse.json({ requests: await listAdminCustomerTypeRequests(parsed.data) });
}
