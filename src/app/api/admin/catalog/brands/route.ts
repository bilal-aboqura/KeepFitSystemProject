import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminCatalogHandler } from "@/lib/catalog/http";
import { createBrand, listBrands, updateBrand } from "@/lib/catalog/brands";

export async function GET() { return adminCatalogHandler(async () => NextResponse.json({ brands: await listBrands(true) })); }
export async function POST(request: NextRequest) { return adminCatalogHandler(async () => NextResponse.json({ brand: await createBrand(await request.json()) }, { status: 201 })); }
export async function PATCH(request: NextRequest) {
  return adminCatalogHandler(async () => {
    const body = z.object({ id: z.string().uuid(), data: z.unknown() }).parse(await request.json());
    return NextResponse.json({ brand: await updateBrand(body.id, body.data) });
  });
}
