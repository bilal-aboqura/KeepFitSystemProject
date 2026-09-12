import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminCatalogHandler } from "@/lib/catalog/http";
import { createCategory, listCategories, updateCategory } from "@/lib/catalog/categories";

export async function GET() { return adminCatalogHandler(async () => NextResponse.json({ categories: await listCategories(true) })); }
export async function POST(request: NextRequest) { return adminCatalogHandler(async () => NextResponse.json({ category: await createCategory(await request.json()) }, { status: 201 })); }
export async function PATCH(request: NextRequest) {
  return adminCatalogHandler(async () => {
    const body = z.object({ id: z.string().uuid(), data: z.unknown() }).parse(await request.json());
    return NextResponse.json({ category: await updateCategory(body.id, body.data) });
  });
}
