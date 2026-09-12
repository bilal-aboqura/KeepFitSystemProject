import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminCatalogHandler } from "@/lib/catalog/http";
import { archiveCatalogProduct } from "@/lib/catalog/products";
export { GET, POST } from "@/app/api/admin/catalog/products/route";

export async function PUT() {
  return NextResponse.json({ error: "Use the variant-aware catalog product endpoint" }, { status: 410 });
}

export async function DELETE(request: NextRequest) {
  return adminCatalogHandler(async (actorId) => {
    const id = z.string().uuid().parse(request.nextUrl.searchParams.get("id"));
    await archiveCatalogProduct(id, actorId);
    return NextResponse.json({ archived: true });
  });
}
