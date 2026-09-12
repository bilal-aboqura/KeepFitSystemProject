import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { getAdminCustomerTypeRequest } from "@/lib/customers/type-requests";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const auth = await requireAdminUser();
  if (auth.denied) return auth.denied;
  const { requestId } = await params;
  if (!z.string().uuid().safeParse(requestId).success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 422 });
  }
  const request = await getAdminCustomerTypeRequest(requestId);
  return request
    ? NextResponse.json({ request })
    : NextResponse.json({ error: "Not found" }, { status: 404 });
}
