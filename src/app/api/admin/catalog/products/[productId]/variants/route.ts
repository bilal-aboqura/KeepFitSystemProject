import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminCatalogHandler } from "@/lib/catalog/http";
import { createCatalogVariant } from "@/lib/catalog/variants";

export async function POST(request: NextRequest, context: { params: Promise<{ productId: string }> }) {
  return adminCatalogHandler(async (actorId) => {
    const { productId } = await context.params;
    z.string().uuid().parse(productId);
    const variantId = await createCatalogVariant(productId, await request.json(), actorId);
    return NextResponse.json({ variant_id: variantId }, { status: 201 });
  });
}
