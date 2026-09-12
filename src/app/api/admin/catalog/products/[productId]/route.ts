import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminCatalogHandler } from "@/lib/catalog/http";
import { archiveCatalogProduct, updateCatalogProduct } from "@/lib/catalog/products";

export async function PATCH(request: NextRequest, context: { params: Promise<{ productId: string }> }) {
  return adminCatalogHandler(async (actorId) => {
    const { productId } = await context.params;
    z.string().uuid().parse(productId);
    const product = await updateCatalogProduct(productId, await request.json(), actorId);
    return NextResponse.json({ product });
  });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ productId: string }> }) {
  return adminCatalogHandler(async (actorId) => {
    const { productId } = await context.params;
    z.string().uuid().parse(productId);
    await archiveCatalogProduct(productId, actorId);
    return NextResponse.json({ archived: true });
  });
}
