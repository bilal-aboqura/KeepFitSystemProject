import { NextResponse, type NextRequest } from "next/server";
import { adminCatalogHandler } from "@/lib/catalog/http";
import { createCatalogProduct } from "@/lib/catalog/products";
import { adminCatalogSearch } from "@/lib/catalog/queries";

export async function GET(request: NextRequest) {
  return adminCatalogHandler(async () => {
    const params = request.nextUrl.searchParams;
    const products = await adminCatalogSearch({
      query: params.get("q") ?? undefined,
      brandId: params.get("brand") ?? undefined,
      categoryId: params.get("category") ?? undefined,
      status: (params.get("status") as "active" | "archived" | "all" | null) ?? "all",
    });
    return NextResponse.json({ products });
  });
}

export async function POST(request: NextRequest) {
  return adminCatalogHandler(async (actorId) => {
    const result = await createCatalogProduct(await request.json(), actorId);
    return NextResponse.json(result, { status: 201 });
  });
}
